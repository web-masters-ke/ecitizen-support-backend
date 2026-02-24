import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
  ClassifyTicketDto,
  QueryClassificationsDto,
  CreateAiOverrideDto,
  CreateAiFeedbackDto,
  RegisterAiModelDto,
  QueryAiMetricsDto,
  QueryRecommendationsDto,
} from './dto/ai.dto';

// ─── Rule-Based Classification Engine ────────────────────────────────────────

interface ClassificationRule {
  keywords: string[];
  categoryPatterns: string[];
  prioritySignal: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  sentimentWeight: number; // -1.0 (very negative) to 1.0 (positive)
}

const CLASSIFICATION_RULES: ClassificationRule[] = [
  // CRITICAL priority signals
  {
    keywords: [
      'system down', 'outage', 'not working', 'emergency', 'critical',
      'all services', 'complete failure', 'cannot access', 'server error',
      'data loss', 'security breach', 'hack', 'unauthorized access',
    ],
    categoryPatterns: ['system', 'infrastructure', 'security'],
    prioritySignal: 'CRITICAL',
    sentimentWeight: -0.9,
  },
  // HIGH priority signals
  {
    keywords: [
      'urgent', 'asap', 'immediately', 'broken', 'error', 'failed',
      'payment failed', 'transaction error', 'identity theft',
      'deadline', 'blocked', 'stuck', 'expired', 'overdue',
      'delayed', 'missing document', 'lost', 'stolen',
    ],
    categoryPatterns: ['payment', 'transaction', 'identity', 'document'],
    prioritySignal: 'HIGH',
    sentimentWeight: -0.7,
  },
  // MEDIUM priority signals
  {
    keywords: [
      'issue', 'problem', 'help', 'not receiving', 'slow', 'wrong',
      'incorrect', 'update', 'change', 'modify', 'status', 'check',
      'pending', 'waiting', 'follow up', 'clarification',
      'renewal', 'extend', 'transfer',
    ],
    categoryPatterns: ['service', 'request', 'update', 'status'],
    prioritySignal: 'MEDIUM',
    sentimentWeight: -0.3,
  },
  // LOW priority signals
  {
    keywords: [
      'inquiry', 'question', 'information', 'how to', 'guide',
      'general', 'feedback', 'suggestion', 'compliment', 'thank',
      'appreciate', 'new application', 'register', 'apply',
    ],
    categoryPatterns: ['inquiry', 'information', 'general', 'application'],
    prioritySignal: 'LOW',
    sentimentWeight: 0.2,
  },
];

// Category keyword mappings for Kenyan government services
const CATEGORY_KEYWORD_MAP: Record<string, string[]> = {
  'Passport Services': [
    'passport', 'travel document', 'immigration', 'visa',
    'east african passport', 'diplomatic passport',
  ],
  'National ID': [
    'id card', 'national id', 'identification', 'huduma namba',
    'id replacement', 'id renewal', 'lost id',
  ],
  'Birth Certificate': [
    'birth certificate', 'birth registration', 'late registration',
    'birth notification',
  ],
  'Death Certificate': [
    'death certificate', 'death registration', 'death notification',
  ],
  'Marriage Certificate': [
    'marriage certificate', 'marriage registration', 'civil union',
  ],
  'Business Registration': [
    'business registration', 'company', 'business name',
    'limited company', 'sole proprietor', 'partnership',
    'business permit', 'single business permit',
  ],
  'Land Services': [
    'land', 'title deed', 'land search', 'land rates',
    'survey', 'land registration', 'property',
  ],
  'Tax Services': [
    'tax', 'kra', 'pin', 'tax return', 'filing', 'tax compliance',
    'itax', 'tax certificate', 'withholding tax',
  ],
  'Vehicle Services': [
    'vehicle', 'logbook', 'driving license', 'ntsa',
    'motor vehicle', 'registration plate', 'inspection',
  ],
  'Health Services': [
    'nhif', 'sha', 'health insurance', 'hospital',
    'medical', 'health facility',
  ],
  'Education Services': [
    'education', 'school', 'university', 'helb', 'student',
    'scholarship', 'bursary', 'examination',
  ],
  'Payment Issues': [
    'payment', 'mpesa', 'pay', 'receipt', 'refund', 'charge',
    'fee', 'transaction', 'billing', 'invoice',
  ],
  'Technical Support': [
    'login', 'password', 'account', 'registration', 'portal',
    'website', 'app', 'download', 'upload', 'otp',
  ],
  'Complaint': [
    'complaint', 'corruption', 'bribery', 'misconduct',
    'poor service', 'rude', 'unprofessional', 'negligence',
  ],
};

@Injectable()
export class AiService {
  private readonly logger = new Logger(AiService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── CLASSIFY TICKET ─────────────────────────────────────────────────────────

  async classifyTicket(dto: ClassifyTicketDto) {
    // Fetch the ticket
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: dto.ticketId },
      include: {
        category: true,
        priority: true,
        agency: { select: { id: true, agencyName: true } },
      },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket "${dto.ticketId}" not found`);
    }

    // Get or use default AI model
    let aiModel: any = null;
    if (dto.aiModelId) {
      aiModel = await this.prisma.aiModel.findUnique({
        where: { id: dto.aiModelId },
      });
    } else {
      aiModel = await this.prisma.aiModel.findFirst({
        where: { isActive: true },
        orderBy: { createdAt: 'desc' },
      });
    }

    // Run classification
    const textToAnalyze =
      `${ticket.subject} ${ticket.description}`.toLowerCase();
    const classification = this.runRuleBasedClassifier(textToAnalyze);

    // Find matching category in the agency
    const predictedCategory = await this.findBestCategory(
      classification.categoryName,
      ticket.agencyId,
    );

    // Find matching priority level
    const predictedPriority = await this.prisma.ticketPriorityLevel.findUnique({
      where: { name: classification.priorityName as any },
    });

    const confidenceScore = classification.confidence;
    const sentimentScore = classification.sentiment;
    const autoApply =
      dto.autoApply && confidenceScore >= 0.75;

    // Log the classification
    const classificationLog = await this.prisma.aiClassificationLog.create({
      data: {
        ticketId: dto.ticketId,
        aiModelId: aiModel?.id,
        predictedCategoryId: predictedCategory?.id,
        predictedPriorityId: predictedPriority?.id,
        confidenceScore,
        sentimentScore,
        autoApplied: autoApply,
        manualOverride: false,
      },
      include: {
        predictedCategory: true,
        predictedPriority: true,
        aiModel: true,
      },
    });

    // Auto-apply if confidence is high enough
    if (autoApply) {
      await this.prisma.ticket.update({
        where: { id: dto.ticketId },
        data: {
          aiPredictedCategoryId: predictedCategory?.id,
          aiConfidenceScore: confidenceScore,
          aiAutoAssigned: true,
          categoryId: predictedCategory?.id || ticket.categoryId,
          priorityId: predictedPriority?.id || ticket.priorityId,
        },
      });
    } else {
      // Just store the prediction reference
      await this.prisma.ticket.update({
        where: { id: dto.ticketId },
        data: {
          aiPredictedCategoryId: predictedCategory?.id,
          aiConfidenceScore: confidenceScore,
        },
      });
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      classification,
      ticket,
    );

    // Store recommendations
    for (const rec of recommendations) {
      await this.prisma.aiRecommendation.create({
        data: {
          ticketId: dto.ticketId,
          recommendationType: rec.type,
          recommendedValue: rec.value,
          confidenceScore: rec.confidence,
        },
      });
    }

    return {
      classificationLog,
      prediction: {
        category: predictedCategory
          ? { id: predictedCategory.id, name: predictedCategory.name }
          : null,
        priority: predictedPriority
          ? { id: predictedPriority.id, name: predictedPriority.name }
          : null,
        confidence: Number(confidenceScore),
        sentiment: Number(sentimentScore),
        autoApplied: autoApply,
      },
      recommendations,
    };
  }

  private runRuleBasedClassifier(text: string): {
    categoryName: string;
    priorityName: string;
    confidence: number;
    sentiment: number;
    matchedKeywords: string[];
  } {
    let bestPriority = 'MEDIUM';
    let highestPriorityScore = 0;
    let totalSentiment = 0;
    let sentimentCount = 0;
    const allMatchedKeywords: string[] = [];

    // Determine priority by keyword matching
    for (const rule of CLASSIFICATION_RULES) {
      let matchCount = 0;
      for (const keyword of rule.keywords) {
        if (text.includes(keyword)) {
          matchCount++;
          allMatchedKeywords.push(keyword);
        }
      }

      if (matchCount > 0) {
        const priorityScores: Record<string, number> = {
          CRITICAL: 4,
          HIGH: 3,
          MEDIUM: 2,
          LOW: 1,
        };
        const score = priorityScores[rule.prioritySignal] * matchCount;
        if (score > highestPriorityScore) {
          highestPriorityScore = score;
          bestPriority = rule.prioritySignal;
        }
        totalSentiment += rule.sentimentWeight * matchCount;
        sentimentCount += matchCount;
      }
    }

    // Determine category by keyword matching
    let bestCategory = 'General Inquiry';
    let bestCategoryScore = 0;

    for (const [category, keywords] of Object.entries(CATEGORY_KEYWORD_MAP)) {
      let matchCount = 0;
      for (const keyword of keywords) {
        if (text.includes(keyword)) {
          matchCount++;
          if (!allMatchedKeywords.includes(keyword)) {
            allMatchedKeywords.push(keyword);
          }
        }
      }
      if (matchCount > bestCategoryScore) {
        bestCategoryScore = matchCount;
        bestCategory = category;
      }
    }

    // Calculate confidence: based on how many keywords matched and how strongly
    const totalPossibleKeywords = allMatchedKeywords.length;
    let confidence: number;
    if (totalPossibleKeywords === 0) {
      confidence = 0.2; // No matches - very low confidence
    } else if (totalPossibleKeywords <= 1) {
      confidence = 0.4;
    } else if (totalPossibleKeywords <= 3) {
      confidence = 0.6;
    } else if (totalPossibleKeywords <= 5) {
      confidence = 0.75;
    } else {
      confidence = Math.min(0.95, 0.75 + totalPossibleKeywords * 0.02);
    }

    // Category confidence bonus: if a category matched strongly
    if (bestCategoryScore >= 2) {
      confidence = Math.min(0.95, confidence + 0.1);
    }

    const sentiment =
      sentimentCount > 0
        ? Math.max(-1, Math.min(1, totalSentiment / sentimentCount))
        : 0;

    return {
      categoryName: bestCategory,
      priorityName: bestPriority,
      confidence: Math.round(confidence * 100) / 100,
      sentiment: Math.round(sentiment * 100) / 100,
      matchedKeywords: [...new Set(allMatchedKeywords)],
    };
  }

  private async findBestCategory(
    categoryName: string,
    agencyId: string,
  ) {
    // First try exact match within agency
    let category = await this.prisma.ticketCategory.findFirst({
      where: {
        agencyId,
        name: { equals: categoryName, mode: 'insensitive' },
        isActive: true,
      },
    });

    if (category) return category;

    // Try partial match
    category = await this.prisma.ticketCategory.findFirst({
      where: {
        agencyId,
        name: { contains: categoryName.split(' ')[0], mode: 'insensitive' },
        isActive: true,
      },
    });

    if (category) return category;

    // Fall back to first active category
    return this.prisma.ticketCategory.findFirst({
      where: { agencyId, isActive: true },
      orderBy: { name: 'asc' },
    });
  }

  private generateRecommendations(
    classification: {
      categoryName: string;
      priorityName: string;
      confidence: number;
      sentiment: number;
      matchedKeywords: string[];
    },
    ticket: any,
  ) {
    const recommendations: Array<{
      type: string;
      value: string;
      confidence: number;
    }> = [];

    // Category recommendation
    recommendations.push({
      type: 'CATEGORY_ASSIGNMENT',
      value: JSON.stringify({
        suggestedCategory: classification.categoryName,
        reason: `Matched keywords: ${classification.matchedKeywords.slice(0, 5).join(', ')}`,
      }),
      confidence: classification.confidence,
    });

    // Priority recommendation
    recommendations.push({
      type: 'PRIORITY_ASSIGNMENT',
      value: JSON.stringify({
        suggestedPriority: classification.priorityName,
        reason:
          classification.priorityName === 'CRITICAL'
            ? 'Critical keywords detected in ticket content'
            : classification.priorityName === 'HIGH'
              ? 'High-urgency indicators found'
              : 'Standard priority assessment',
      }),
      confidence: classification.confidence,
    });

    // Escalation recommendation for negative sentiment + high priority
    if (
      classification.sentiment < -0.5 &&
      ['CRITICAL', 'HIGH'].includes(classification.priorityName)
    ) {
      recommendations.push({
        type: 'ESCALATION',
        value: JSON.stringify({
          suggestEscalation: true,
          reason: 'Negative sentiment combined with high priority indicates urgent attention needed',
          sentimentScore: classification.sentiment,
        }),
        confidence: Math.min(0.9, classification.confidence + 0.1),
      });
    }

    // Response template recommendation based on category
    if (classification.confidence >= 0.5) {
      recommendations.push({
        type: 'RESPONSE_TEMPLATE',
        value: JSON.stringify({
          suggestedAction: `Use ${classification.categoryName} response template`,
          category: classification.categoryName,
        }),
        confidence: classification.confidence * 0.8,
      });
    }

    return recommendations;
  }

  // ─── OVERRIDE ────────────────────────────────────────────────────────────────

  async createOverride(dto: CreateAiOverrideDto) {
    const classificationLog = await this.prisma.aiClassificationLog.findUnique({
      where: { id: dto.classificationLogId },
    });

    if (!classificationLog) {
      throw new NotFoundException(
        `Classification log "${dto.classificationLogId}" not found`,
      );
    }

    // Mark the original classification as overridden
    await this.prisma.aiClassificationLog.update({
      where: { id: dto.classificationLogId },
      data: { manualOverride: true },
    });

    // Update the ticket with the correct values
    const ticketUpdate: any = {};
    if (dto.correctCategoryId) ticketUpdate.categoryId = dto.correctCategoryId;
    if (dto.correctPriorityId) ticketUpdate.priorityId = dto.correctPriorityId;

    if (Object.keys(ticketUpdate).length > 0) {
      await this.prisma.ticket.update({
        where: { id: dto.ticketId },
        data: ticketUpdate,
      });
    }

    // Create a new classification log entry recording the override
    const overrideLog = await this.prisma.aiClassificationLog.create({
      data: {
        ticketId: dto.ticketId,
        aiModelId: classificationLog.aiModelId,
        predictedCategoryId: dto.correctCategoryId || classificationLog.predictedCategoryId,
        predictedPriorityId: dto.correctPriorityId || classificationLog.predictedPriorityId,
        confidenceScore: 1.0, // Human override is 100% confidence
        autoApplied: true,
        manualOverride: true,
      },
      include: {
        predictedCategory: true,
        predictedPriority: true,
        ticket: { select: { id: true, ticketNumber: true, subject: true } },
      },
    });

    return {
      overrideLog,
      originalClassificationId: dto.classificationLogId,
      overrideReason: dto.overrideReason,
      performedBy: dto.performedBy,
    };
  }

  // ─── FEEDBACK ──────────────────────────────────────────────────────────────

  async submitFeedback(dto: CreateAiFeedbackDto) {
    const classificationLog = await this.prisma.aiClassificationLog.findUnique({
      where: { id: dto.classificationLogId },
      include: { ticket: true },
    });

    if (!classificationLog) {
      throw new NotFoundException(
        `Classification log "${dto.classificationLogId}" not found`,
      );
    }

    // Store feedback as a recommendation record with feedback type
    const feedback = await this.prisma.aiRecommendation.create({
      data: {
        ticketId: classificationLog.ticketId,
        recommendationType: 'CLASSIFICATION_FEEDBACK',
        recommendedValue: JSON.stringify({
          classificationLogId: dto.classificationLogId,
          wasAccurate: dto.wasAccurate,
          rating: dto.rating,
          comment: dto.comment,
        }),
        confidenceScore: dto.wasAccurate ? 1.0 : 0.0,
        applied: false,
        appliedBy: dto.userId,
      },
    });

    return {
      feedbackId: feedback.id,
      classificationLogId: dto.classificationLogId,
      wasAccurate: dto.wasAccurate,
      rating: dto.rating,
    };
  }

  // ─── METRICS ─────────────────────────────────────────────────────────────────

  async getMetrics(query: QueryAiMetricsDto) {
    const where: any = {};
    if (query.aiModelId) where.aiModelId = query.aiModelId;
    if (query.startDate || query.endDate) {
      where.createdAt = {};
      if (query.startDate)
        where.createdAt.gte = new Date(query.startDate);
      if (query.endDate) where.createdAt.lte = new Date(query.endDate);
    }

    const [totalClassifications, autoApplied, manualOverrides, avgConfidence] =
      await Promise.all([
        this.prisma.aiClassificationLog.count({ where }),
        this.prisma.aiClassificationLog.count({
          where: { ...where, autoApplied: true, manualOverride: false },
        }),
        this.prisma.aiClassificationLog.count({
          where: { ...where, manualOverride: true },
        }),
        this.prisma.aiClassificationLog.aggregate({
          where,
          _avg: { confidenceScore: true },
        }),
      ]);

    // Confidence distribution buckets
    const confidenceBuckets = await Promise.all([
      this.prisma.aiClassificationLog.count({
        where: { ...where, confidenceScore: { lt: 0.3 } },
      }),
      this.prisma.aiClassificationLog.count({
        where: {
          ...where,
          confidenceScore: { gte: 0.3, lt: 0.5 },
        },
      }),
      this.prisma.aiClassificationLog.count({
        where: {
          ...where,
          confidenceScore: { gte: 0.5, lt: 0.7 },
        },
      }),
      this.prisma.aiClassificationLog.count({
        where: {
          ...where,
          confidenceScore: { gte: 0.7, lt: 0.9 },
        },
      }),
      this.prisma.aiClassificationLog.count({
        where: { ...where, confidenceScore: { gte: 0.9 } },
      }),
    ]);

    // Calculate feedback-based accuracy
    const feedbackRecords = await this.prisma.aiRecommendation.findMany({
      where: { recommendationType: 'CLASSIFICATION_FEEDBACK' },
      select: { recommendedValue: true },
    });

    let accurateFeedback = 0;
    let totalFeedback = 0;
    for (const rec of feedbackRecords) {
      try {
        const val =
          typeof rec.recommendedValue === 'string'
            ? JSON.parse(rec.recommendedValue)
            : rec.recommendedValue;
        if (val && typeof val.wasAccurate === 'boolean') {
          totalFeedback++;
          if (val.wasAccurate) accurateFeedback++;
        }
      } catch {
        // Skip invalid feedback records
      }
    }

    const overrideRate =
      totalClassifications > 0
        ? Math.round((manualOverrides / totalClassifications) * 10000) / 100
        : 0;

    const autoApplyRate =
      totalClassifications > 0
        ? Math.round((autoApplied / totalClassifications) * 10000) / 100
        : 0;

    const feedbackAccuracy =
      totalFeedback > 0
        ? Math.round((accurateFeedback / totalFeedback) * 10000) / 100
        : null;

    return {
      totalClassifications,
      autoApplied,
      manualOverrides,
      overrideRate,
      autoApplyRate,
      averageConfidence: avgConfidence._avg.confidenceScore
        ? Number(avgConfidence._avg.confidenceScore)
        : null,
      feedbackAccuracy,
      totalFeedbackReceived: totalFeedback,
      confidenceDistribution: {
        veryLow: confidenceBuckets[0],   // < 0.3
        low: confidenceBuckets[1],       // 0.3 - 0.5
        medium: confidenceBuckets[2],    // 0.5 - 0.7
        high: confidenceBuckets[3],      // 0.7 - 0.9
        veryHigh: confidenceBuckets[4],  // >= 0.9
      },
    };
  }

  // ─── CLASSIFICATIONS LIST ──────────────────────────────────────────────────

  async getClassifications(query: QueryClassificationsDto) {
    const where: any = {};
    if (query.ticketId) where.ticketId = query.ticketId;
    if (query.aiModelId) where.aiModelId = query.aiModelId;

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.prisma.aiClassificationLog.findMany({
        where,
        include: {
          ticket: {
            select: { id: true, ticketNumber: true, subject: true },
          },
          predictedCategory: {
            select: { id: true, name: true },
          },
          predictedPriority: {
            select: { id: true, name: true },
          },
          aiModel: {
            select: { id: true, modelName: true, modelVersion: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.aiClassificationLog.count({ where }),
    ]);

    return {
      data,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // ─── AI MODELS ─────────────────────────────────────────────────────────────

  async getModels() {
    return this.prisma.aiModel.findMany({
      include: {
        _count: { select: { classificationLogs: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async registerModel(dto: RegisterAiModelDto) {
    const existing = await this.prisma.aiModel.findFirst({
      where: {
        modelName: dto.modelName,
        modelVersion: dto.modelVersion,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Model "${dto.modelName}" version "${dto.modelVersion}" already exists`,
      );
    }

    return this.prisma.aiModel.create({
      data: {
        modelName: dto.modelName,
        modelVersion: dto.modelVersion,
        modelType: dto.modelType,
        deploymentEnvironment: dto.deploymentEnvironment,
        isActive: dto.isActive ?? true,
      },
    });
  }

  // ─── RECOMMENDATIONS ──────────────────────────────────────────────────────

  async getRecommendations(query: QueryRecommendationsDto) {
    const ticket = await this.prisma.ticket.findUnique({
      where: { id: query.ticketId },
    });

    if (!ticket) {
      throw new NotFoundException(`Ticket "${query.ticketId}" not found`);
    }

    return this.prisma.aiRecommendation.findMany({
      where: {
        ticketId: query.ticketId,
        recommendationType: { not: 'CLASSIFICATION_FEEDBACK' },
      },
      include: {
        applier: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
