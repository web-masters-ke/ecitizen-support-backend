import {
  Injectable,
  NotFoundException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../../config/prisma.service';
import {
  CreateKbCategoryDto,
  QueryKbCategoriesDto,
  CreateKbArticleDto,
  UpdateKbArticleDto,
  QueryKbArticlesDto,
  CreateKbArticleVersionDto,
  CreateKbFeedbackDto,
  CreateKbTagDto,
  QueryKbTagsDto,
} from './dto/knowledge-base.dto';

@Injectable()
export class KnowledgeBaseService {
  private readonly logger = new Logger(KnowledgeBaseService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── CATEGORIES ──────────────────────────────────────────────────────────────

  async createCategory(dto: CreateKbCategoryDto) {
    // Check for duplicate name within agency scope
    const existing = await this.prisma.kbCategory.findFirst({
      where: {
        agencyId: dto.agencyId || null,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Category "${dto.name}" already exists for this agency`,
      );
    }

    return this.prisma.kbCategory.create({
      data: {
        name: dto.name,
        description: dto.description,
        agencyId: dto.agencyId,
        parentCategoryId: dto.parentCategoryId,
      },
      include: {
        agency: { select: { id: true, agencyName: true } },
        parentCategory: { select: { id: true, name: true } },
        childCategories: { select: { id: true, name: true } },
      },
    });
  }

  async getCategories(query: QueryKbCategoriesDto) {
    const where: any = {};
    if (query.agencyId) where.agencyId = query.agencyId;
    if (query.isActive !== undefined) where.isActive = query.isActive;

    return this.prisma.kbCategory.findMany({
      where,
      include: {
        agency: { select: { id: true, agencyName: true } },
        parentCategory: { select: { id: true, name: true } },
        childCategories: { select: { id: true, name: true } },
        _count: { select: { articles: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  // ─── ARTICLES ────────────────────────────────────────────────────────────────

  private generateSlug(title: string): string {
    return title
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, '')
      .replace(/[\s_]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }

  private async ensureUniqueSlug(
    baseSlug: string,
    agencyId: string | null,
  ): Promise<string> {
    let slug = baseSlug;
    let counter = 1;

    while (true) {
      const existing = await this.prisma.kbArticle.findFirst({
        where: { agencyId: agencyId || null, slug },
      });
      if (!existing) return slug;
      slug = `${baseSlug}-${counter}`;
      counter++;
    }
  }

  async createArticle(dto: CreateKbArticleDto) {
    const slug = await this.ensureUniqueSlug(
      this.generateSlug(dto.title),
      dto.agencyId || null,
    );

    // Create article with first version in a transaction
    return this.prisma.$transaction(async (tx) => {
      const article = await tx.kbArticle.create({
        data: {
          title: dto.title,
          slug,
          agencyId: dto.agencyId,
          categoryId: dto.categoryId,
          visibility: dto.visibility as any || 'PUBLIC',
          createdBy: dto.createdBy,
        },
      });

      // Create version 1
      const version = await tx.kbArticleVersion.create({
        data: {
          articleId: article.id,
          versionNumber: 1,
          content: dto.content,
          summary: dto.summary,
          changeNotes: 'Initial version',
          createdBy: dto.createdBy,
        },
      });

      // Set current version
      const updatedArticle = await tx.kbArticle.update({
        where: { id: article.id },
        data: { currentVersionId: version.id },
        include: {
          agency: { select: { id: true, agencyName: true } },
          category: { select: { id: true, name: true } },
          versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
          creator: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
        },
      });

      // Assign tags if provided
      if (dto.tagIds && dto.tagIds.length > 0) {
        await tx.kbArticleTagMapping.createMany({
          data: dto.tagIds.map((tagId) => ({
            articleId: article.id,
            tagId,
          })),
          skipDuplicates: true,
        });
      }

      return updatedArticle;
    });
  }

  async getArticles(query: QueryKbArticlesDto) {
    const where: any = {};

    if (query.agencyId) where.agencyId = query.agencyId;
    if (query.categoryId) where.categoryId = query.categoryId;
    if (query.visibility) where.visibility = query.visibility;
    if (query.publishedOnly) where.isPublished = true;

    if (query.search) {
      where.OR = [
        { title: { contains: query.search, mode: 'insensitive' } },
        { slug: { contains: query.search, mode: 'insensitive' } },
        {
          versions: {
            some: {
              content: { contains: query.search, mode: 'insensitive' },
            },
          },
        },
      ];
    }

    const page = query.page || 1;
    const limit = query.limit || 20;
    const skip = (page - 1) * limit;

    const [articles, total] = await Promise.all([
      this.prisma.kbArticle.findMany({
        where,
        include: {
          agency: { select: { id: true, agencyName: true } },
          category: { select: { id: true, name: true } },
          creator: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          tagMappings: {
            include: { tag: { select: { id: true, name: true } } },
          },
          _count: { select: { views: true, feedback: true, versions: true } },
        },
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.kbArticle.count({ where }),
    ]);

    return {
      data: articles,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getArticleById(id: string, viewedBy?: string, ipAddress?: string) {
    const article = await this.prisma.kbArticle.findUnique({
      where: { id },
      include: {
        agency: { select: { id: true, agencyName: true } },
        category: { select: { id: true, name: true } },
        creator: {
          select: { id: true, firstName: true, lastName: true, email: true },
        },
        versions: {
          orderBy: { versionNumber: 'desc' },
          include: {
            creator: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                email: true,
              },
            },
          },
        },
        tagMappings: {
          include: { tag: { select: { id: true, name: true } } },
        },
        _count: { select: { views: true, feedback: true } },
      },
    });

    if (!article) {
      throw new NotFoundException(`Article with ID "${id}" not found`);
    }

    // Track view asynchronously (fire and forget)
    this.trackView(id, viewedBy, ipAddress).catch((err) =>
      this.logger.warn(`Failed to track view for article ${id}: ${err.message}`),
    );

    return article;
  }

  async updateArticle(id: string, dto: UpdateKbArticleDto) {
    const article = await this.prisma.kbArticle.findUnique({
      where: { id },
    });

    if (!article) {
      throw new NotFoundException(`Article with ID "${id}" not found`);
    }

    const data: any = {};
    if (dto.title) {
      data.title = dto.title;
      data.slug = await this.ensureUniqueSlug(
        this.generateSlug(dto.title),
        article.agencyId,
      );
    }
    if (dto.categoryId !== undefined) data.categoryId = dto.categoryId;
    if (dto.visibility) data.visibility = dto.visibility;

    const updated = await this.prisma.$transaction(async (tx) => {
      const updatedArticle = await tx.kbArticle.update({
        where: { id },
        data,
        include: {
          agency: { select: { id: true, agencyName: true } },
          category: { select: { id: true, name: true } },
          creator: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          tagMappings: {
            include: { tag: { select: { id: true, name: true } } },
          },
        },
      });

      // Update tags if provided
      if (dto.tagIds !== undefined) {
        // Remove existing tags
        await tx.kbArticleTagMapping.deleteMany({
          where: { articleId: id },
        });

        // Add new tags
        if (dto.tagIds.length > 0) {
          await tx.kbArticleTagMapping.createMany({
            data: dto.tagIds.map((tagId) => ({
              articleId: id,
              tagId,
            })),
            skipDuplicates: true,
          });
        }
      }

      return updatedArticle;
    });

    return updated;
  }

  async addArticleVersion(id: string, dto: CreateKbArticleVersionDto) {
    const article = await this.prisma.kbArticle.findUnique({
      where: { id },
      include: {
        versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
      },
    });

    if (!article) {
      throw new NotFoundException(`Article with ID "${id}" not found`);
    }

    const nextVersion =
      article.versions.length > 0
        ? article.versions[0].versionNumber + 1
        : 1;

    return this.prisma.$transaction(async (tx) => {
      const version = await tx.kbArticleVersion.create({
        data: {
          articleId: id,
          versionNumber: nextVersion,
          content: dto.content,
          summary: dto.summary,
          changeNotes: dto.changeNotes,
          createdBy: dto.createdBy,
        },
      });

      // Update article's current version pointer
      await tx.kbArticle.update({
        where: { id },
        data: { currentVersionId: version.id },
      });

      return version;
    });
  }

  async publishArticle(id: string) {
    const article = await this.prisma.kbArticle.findUnique({
      where: { id },
      include: { versions: { orderBy: { versionNumber: 'desc' }, take: 1 } },
    });

    if (!article) {
      throw new NotFoundException(`Article with ID "${id}" not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      // Mark current version as published
      if (article.versions.length > 0) {
        await tx.kbArticleVersion.update({
          where: { id: article.versions[0].id },
          data: { isPublished: true },
        });
      }

      return tx.kbArticle.update({
        where: { id },
        data: {
          isPublished: true,
          publishedAt: new Date(),
        },
        include: {
          agency: { select: { id: true, agencyName: true } },
          category: { select: { id: true, name: true } },
          versions: { orderBy: { versionNumber: 'desc' }, take: 1 },
        },
      });
    });
  }

  // ─── FEEDBACK ──────────────────────────────────────────────────────────────

  async addFeedback(articleId: string, dto: CreateKbFeedbackDto) {
    const article = await this.prisma.kbArticle.findUnique({
      where: { id: articleId },
    });

    if (!article) {
      throw new NotFoundException(`Article with ID "${articleId}" not found`);
    }

    return this.prisma.kbFeedback.create({
      data: {
        articleId,
        userId: dto.userId,
        rating: dto.rating,
        wasHelpful: dto.wasHelpful,
        feedbackComment: dto.feedbackComment,
      },
      include: {
        user: {
          select: { id: true, firstName: true, lastName: true },
        },
      },
    });
  }

  async getArticleFeedback(articleId: string) {
    const article = await this.prisma.kbArticle.findUnique({
      where: { id: articleId },
    });

    if (!article) {
      throw new NotFoundException(`Article with ID "${articleId}" not found`);
    }

    const [feedback, stats] = await Promise.all([
      this.prisma.kbFeedback.findMany({
        where: { articleId },
        include: {
          user: {
            select: { id: true, firstName: true, lastName: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.kbFeedback.aggregate({
        where: { articleId },
        _avg: { rating: true },
        _count: { _all: true, wasHelpful: true },
      }),
    ]);

    const helpfulCount = await this.prisma.kbFeedback.count({
      where: { articleId, wasHelpful: true },
    });

    const notHelpfulCount = await this.prisma.kbFeedback.count({
      where: { articleId, wasHelpful: false },
    });

    return {
      feedback,
      stats: {
        averageRating: stats._avg.rating
          ? Number(stats._avg.rating)
          : null,
        totalFeedback: stats._count._all,
        helpfulCount,
        notHelpfulCount,
        helpfulPercentage:
          helpfulCount + notHelpfulCount > 0
            ? Math.round(
                (helpfulCount / (helpfulCount + notHelpfulCount)) * 100,
              )
            : null,
      },
    };
  }

  // ─── TAGS ──────────────────────────────────────────────────────────────────

  async createTag(dto: CreateKbTagDto) {
    const existing = await this.prisma.kbTag.findFirst({
      where: {
        agencyId: dto.agencyId || null,
        name: dto.name,
      },
    });

    if (existing) {
      throw new ConflictException(
        `Tag "${dto.name}" already exists for this agency`,
      );
    }

    return this.prisma.kbTag.create({
      data: {
        name: dto.name,
        agencyId: dto.agencyId,
      },
      include: {
        agency: { select: { id: true, agencyName: true } },
      },
    });
  }

  async getTags(query: QueryKbTagsDto) {
    const where: any = {};
    if (query.agencyId) where.agencyId = query.agencyId;

    return this.prisma.kbTag.findMany({
      where,
      include: {
        agency: { select: { id: true, agencyName: true } },
        _count: { select: { mappings: true } },
      },
      orderBy: { name: 'asc' },
    });
  }

  // ─── VIEW TRACKING ────────────────────────────────────────────────────────

  private async trackView(
    articleId: string,
    viewedBy?: string,
    ipAddress?: string,
  ) {
    await this.prisma.kbArticleView.create({
      data: {
        articleId,
        viewedBy: viewedBy || null,
        ipAddress: ipAddress || null,
      },
    });
  }
}
