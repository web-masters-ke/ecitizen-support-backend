import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '@config/prisma.service';
import {
  CreateAutomationRuleDto,
  UpdateAutomationRuleDto,
  CreateAutomationActionDto,
} from './dto/workflow.dto';

/**
 * Supported condition operators for the rule engine.
 */
type ConditionOperator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'nin'
  | 'contains'
  | 'exists';

interface SingleCondition {
  field: string;
  operator: ConditionOperator;
  value: any;
}

interface ConditionGroup {
  and?: Array<SingleCondition | ConditionGroup>;
  or?: Array<SingleCondition | ConditionGroup>;
}

type ConditionExpression = SingleCondition | ConditionGroup;

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ============================================
  // Automation Rule CRUD
  // ============================================

  async createRule(dto: CreateAutomationRuleDto) {
    return this.prisma.automationRule.create({
      data: {
        agencyId: dto.agencyId,
        ruleName: dto.ruleName,
        triggerEvent: dto.triggerEvent,
        conditionExpression: dto.conditionExpression,
        isActive: dto.isActive ?? true,
        createdBy: dto.createdBy,
      },
      include: {
        actions: { orderBy: { executionOrder: 'asc' } },
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
    });
  }

  async findRules(agencyId?: string, triggerEvent?: string) {
    const where: any = {};
    if (agencyId) where.agencyId = agencyId;
    if (triggerEvent) where.triggerEvent = triggerEvent;

    return this.prisma.automationRule.findMany({
      where,
      include: {
        actions: { orderBy: { executionOrder: 'asc' } },
        agency: { select: { id: true, agencyName: true, agencyCode: true } },
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findRuleById(id: string) {
    const rule = await this.prisma.automationRule.findUnique({
      where: { id },
      include: {
        actions: { orderBy: { executionOrder: 'asc' } },
        agency: { select: { id: true, agencyName: true, agencyCode: true } },
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        executionLogs: {
          orderBy: { executedAt: 'desc' },
          take: 20,
        },
      },
    });
    if (!rule) {
      throw new NotFoundException(`Automation rule ${id} not found`);
    }
    return rule;
  }

  async updateRule(id: string, dto: UpdateAutomationRuleDto) {
    await this.findRuleById(id);
    return this.prisma.automationRule.update({
      where: { id },
      data: {
        ...(dto.ruleName !== undefined && { ruleName: dto.ruleName }),
        ...(dto.triggerEvent !== undefined && { triggerEvent: dto.triggerEvent }),
        ...(dto.conditionExpression !== undefined && {
          conditionExpression: dto.conditionExpression,
        }),
        ...(dto.isActive !== undefined && { isActive: dto.isActive }),
      },
      include: {
        actions: { orderBy: { executionOrder: 'asc' } },
      },
    });
  }

  async addAction(ruleId: string, dto: CreateAutomationActionDto) {
    await this.findRuleById(ruleId);
    return this.prisma.automationAction.create({
      data: {
        automationRuleId: ruleId,
        actionType: dto.actionType,
        actionPayload: dto.actionPayload ?? undefined,
        executionOrder: dto.executionOrder ?? 1,
      },
    });
  }

  // ============================================
  // Workflow Triggers
  // ============================================

  async findTriggersForTicket(ticketId: string) {
    return this.prisma.workflowTrigger.findMany({
      where: { ticketId },
      include: {
        trigger: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  // ============================================
  // Rule Engine - evaluate and execute rules
  // ============================================

  /**
   * evaluateAndExecute - core automation engine.
   * Called when an event occurs (e.g. TICKET_CREATED).
   * Finds all matching rules for the event and agency, evaluates conditions,
   * and executes actions.
   *
   * @param triggerEvent - The event name (e.g. TICKET_CREATED, TICKET_STATUS_CHANGED)
   * @param agencyId - The agency context
   * @param context - The event context/payload (ticket data, etc.)
   * @param triggeredBy - User ID who triggered the event
   */
  async evaluateAndExecute(
    triggerEvent: string,
    agencyId: string,
    context: Record<string, any>,
    triggeredBy?: string,
  ) {
    // Find all active rules for this agency and trigger event
    const rules = await this.prisma.automationRule.findMany({
      where: {
        agencyId,
        triggerEvent,
        isActive: true,
      },
      include: {
        actions: { orderBy: { executionOrder: 'asc' } },
      },
    });

    if (rules.length === 0) {
      return { rulesEvaluated: 0, actionsExecuted: 0 };
    }

    let actionsExecuted = 0;

    for (const rule of rules) {
      let conditionMet = false;

      try {
        const condition: ConditionExpression = JSON.parse(
          rule.conditionExpression,
        );
        conditionMet = this.evaluateCondition(condition, context);
      } catch (err) {
        this.logger.error(
          `Failed to parse/evaluate condition for rule ${rule.id}: ${err}`,
        );
        await this.logExecution(
          context.ticketId,
          rule.id,
          'CONDITION_EVALUATION',
          'FAILED',
          `Condition parse error: ${err}`,
        );
        continue;
      }

      if (!conditionMet) {
        this.logger.debug(
          `Rule ${rule.ruleName} (${rule.id}) condition not met, skipping`,
        );
        continue;
      }

      // Record trigger
      await this.prisma.workflowTrigger.create({
        data: {
          ticketId: context.ticketId ?? null,
          triggerType: triggerEvent,
          triggeredBy: triggeredBy ?? null,
          triggerSource: 'AUTOMATION_RULE',
        },
      });

      // Execute each action in order
      for (const action of rule.actions) {
        try {
          await this.executeAction(action, context);
          actionsExecuted++;
          await this.logExecution(
            context.ticketId,
            rule.id,
            action.actionType,
            'SUCCESS',
          );
        } catch (err) {
          this.logger.error(
            `Failed to execute action ${action.actionType} for rule ${rule.id}: ${err}`,
          );
          await this.logExecution(
            context.ticketId,
            rule.id,
            action.actionType,
            'FAILED',
            String(err),
          );
        }
      }
    }

    return { rulesEvaluated: rules.length, actionsExecuted };
  }

  // ============================================
  // Condition Evaluator
  // ============================================

  private evaluateCondition(
    condition: ConditionExpression,
    context: Record<string, any>,
  ): boolean {
    // Check if this is a group (and/or)
    if ('and' in condition && Array.isArray(condition.and)) {
      return condition.and.every((c) => this.evaluateCondition(c, context));
    }
    if ('or' in condition && Array.isArray(condition.or)) {
      return condition.or.some((c) => this.evaluateCondition(c, context));
    }

    // Single condition
    const single = condition as SingleCondition;
    const fieldValue = this.getNestedValue(context, single.field);

    switch (single.operator) {
      case 'eq':
        return fieldValue === single.value;
      case 'neq':
        return fieldValue !== single.value;
      case 'gt':
        return fieldValue > single.value;
      case 'gte':
        return fieldValue >= single.value;
      case 'lt':
        return fieldValue < single.value;
      case 'lte':
        return fieldValue <= single.value;
      case 'in':
        return Array.isArray(single.value) && single.value.includes(fieldValue);
      case 'nin':
        return (
          Array.isArray(single.value) && !single.value.includes(fieldValue)
        );
      case 'contains':
        return (
          typeof fieldValue === 'string' &&
          fieldValue.toLowerCase().includes(String(single.value).toLowerCase())
        );
      case 'exists':
        return single.value
          ? fieldValue !== undefined && fieldValue !== null
          : fieldValue === undefined || fieldValue === null;
      default:
        this.logger.warn(`Unknown operator: ${single.operator}`);
        return false;
    }
  }

  private getNestedValue(obj: Record<string, any>, path: string): any {
    return path.split('.').reduce((current, key) => {
      return current && current[key] !== undefined ? current[key] : undefined;
    }, obj);
  }

  // ============================================
  // Action Executor
  // ============================================

  private async executeAction(
    action: {
      actionType: string;
      actionPayload: any;
    },
    context: Record<string, any>,
  ) {
    const payload = action.actionPayload ?? {};
    const ticketId = context.ticketId;

    switch (action.actionType) {
      case 'ASSIGN_TO_USER':
        if (!ticketId || !payload.userId) {
          throw new Error('ASSIGN_TO_USER requires ticketId and payload.userId');
        }
        await this.prisma.ticket.update({
          where: { id: ticketId },
          data: { currentAssigneeId: payload.userId },
        });
        await this.prisma.ticketAssignment.create({
          data: {
            ticketId,
            assignedTo: payload.userId,
            assignmentReason: payload.reason ?? 'Auto-assigned by automation rule',
          },
        });
        this.logger.log(
          `Action ASSIGN_TO_USER: ticket ${ticketId} assigned to ${payload.userId}`,
        );
        break;

      case 'CHANGE_STATUS':
        if (!ticketId || !payload.statusId) {
          throw new Error(
            'CHANGE_STATUS requires ticketId and payload.statusId',
          );
        }
        const currentTicket = await this.prisma.ticket.findUnique({
          where: { id: ticketId },
          select: { statusId: true },
        });
        await this.prisma.ticket.update({
          where: { id: ticketId },
          data: { statusId: payload.statusId },
        });
        await this.prisma.ticketHistory.create({
          data: {
            ticketId,
            oldStatusId: currentTicket?.statusId,
            newStatusId: payload.statusId,
            changeReason: payload.reason ?? 'Status changed by automation rule',
          },
        });
        this.logger.log(
          `Action CHANGE_STATUS: ticket ${ticketId} status changed to ${payload.statusId}`,
        );
        break;

      case 'CHANGE_PRIORITY':
        if (!ticketId || !payload.priorityId) {
          throw new Error(
            'CHANGE_PRIORITY requires ticketId and payload.priorityId',
          );
        }
        await this.prisma.ticket.update({
          where: { id: ticketId },
          data: { priorityId: payload.priorityId },
        });
        this.logger.log(
          `Action CHANGE_PRIORITY: ticket ${ticketId} priority changed to ${payload.priorityId}`,
        );
        break;

      case 'ADD_TAG':
        if (!ticketId || !payload.tagId) {
          throw new Error('ADD_TAG requires ticketId and payload.tagId');
        }
        await this.prisma.ticketTagMapping.upsert({
          where: {
            ticketId_tagId: { ticketId, tagId: payload.tagId },
          },
          create: { ticketId, tagId: payload.tagId },
          update: {},
        });
        this.logger.log(
          `Action ADD_TAG: tag ${payload.tagId} added to ticket ${ticketId}`,
        );
        break;

      case 'ESCALATE':
        if (!ticketId) {
          throw new Error('ESCALATE requires ticketId');
        }
        const ticket = await this.prisma.ticket.findUnique({
          where: { id: ticketId },
          select: { escalationLevel: true },
        });
        const newLevel = (ticket?.escalationLevel ?? 0) + 1;
        await this.prisma.ticket.update({
          where: { id: ticketId },
          data: {
            isEscalated: true,
            escalationLevel: newLevel,
          },
        });
        await this.prisma.escalationEvent.create({
          data: {
            ticketId,
            previousLevel: ticket?.escalationLevel ?? 0,
            newLevel,
            escalationReason:
              payload.reason ?? 'Escalated by automation rule',
            triggeredBy: 'SYSTEM',
            escalatedToRole: payload.escalateToRole,
          },
        });
        this.logger.log(
          `Action ESCALATE: ticket ${ticketId} escalated to level ${newLevel}`,
        );
        break;

      case 'SEND_NOTIFICATION':
        // This creates a notification record. The notifications module handles dispatch.
        if (!payload.channel || !payload.templateId) {
          throw new Error(
            'SEND_NOTIFICATION requires payload.channel and payload.templateId',
          );
        }
        await this.prisma.notification.create({
          data: {
            agencyId: context.agencyId,
            ticketId: ticketId ?? null,
            templateId: payload.templateId,
            triggerEvent: context.triggerEvent ?? 'AUTOMATION_RULE',
            channel: payload.channel,
            status: 'PENDING',
          },
        });
        this.logger.log(
          `Action SEND_NOTIFICATION: notification queued for ticket ${ticketId}`,
        );
        break;

      default:
        this.logger.warn(`Unknown action type: ${action.actionType}`);
        throw new Error(`Unknown action type: ${action.actionType}`);
    }
  }

  // ============================================
  // Execution Logging
  // ============================================

  private async logExecution(
    ticketId: string | undefined,
    ruleId: string,
    actionType: string,
    status: 'SUCCESS' | 'FAILED' | 'SKIPPED',
    errorMessage?: string,
  ) {
    await this.prisma.automationExecutionLog.create({
      data: {
        ticketId: ticketId ?? null,
        automationRuleId: ruleId,
        actionType,
        executionStatus: status,
        errorMessage: errorMessage ?? null,
      },
    });
  }
}
