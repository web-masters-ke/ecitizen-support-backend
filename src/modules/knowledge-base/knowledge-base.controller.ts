import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  Query,
  Req,
  ParseUUIDPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { Public } from '@/common/decorators/public.decorator';
import { KnowledgeBaseService } from './knowledge-base.service';
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

@ApiTags('Knowledge Base')
@ApiBearerAuth()
@Controller('kb')
export class KnowledgeBaseController {
  constructor(private readonly kbService: KnowledgeBaseService) {}

  // ─── CATEGORIES ──────────────────────────────────────────────────────────────

  @Post('categories')
  @ApiOperation({ summary: 'Create a knowledge base category' })
  createCategory(@Body() dto: CreateKbCategoryDto) {
    return this.kbService.createCategory(dto);
  }

  @Public()
  @Get('categories')
  @ApiOperation({ summary: 'List knowledge base categories' })
  getCategories(@Query() query: QueryKbCategoriesDto) {
    return this.kbService.getCategories(query);
  }

  // ─── ARTICLES ────────────────────────────────────────────────────────────────

  @Post('articles')
  @ApiOperation({ summary: 'Create a knowledge base article' })
  createArticle(@Body() dto: CreateKbArticleDto) {
    return this.kbService.createArticle(dto);
  }

  @Public()
  @Get('articles')
  @ApiOperation({ summary: 'List knowledge base articles (paginated, filterable)' })
  getArticles(@Query() query: QueryKbArticlesDto) {
    return this.kbService.getArticles(query);
  }

  @Public()
  @Get('articles/:id')
  @ApiOperation({ summary: 'Get article by ID with all versions' })
  getArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const userId = (req as any).user?.id;
    const ipAddress =
      (req.headers['x-forwarded-for'] as string) || req.ip;
    return this.kbService.getArticleById(id, userId, ipAddress);
  }

  @Patch('articles/:id')
  @ApiOperation({ summary: 'Update article metadata' })
  updateArticle(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateKbArticleDto,
  ) {
    return this.kbService.updateArticle(id, dto);
  }

  @Post('articles/:id/versions')
  @ApiOperation({ summary: 'Add a new version to an article' })
  addVersion(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateKbArticleVersionDto,
  ) {
    return this.kbService.addArticleVersion(id, dto);
  }

  @Post('articles/:id/publish')
  @ApiOperation({ summary: 'Publish an article' })
  publishArticle(@Param('id', ParseUUIDPipe) id: string) {
    return this.kbService.publishArticle(id);
  }

  @Post('articles/:id/feedback')
  @ApiOperation({ summary: 'Submit feedback on an article' })
  addFeedback(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateKbFeedbackDto,
  ) {
    return this.kbService.addFeedback(id, dto);
  }

  @Get('articles/:id/feedback')
  @ApiOperation({ summary: 'Get feedback for an article' })
  getArticleFeedback(@Param('id', ParseUUIDPipe) id: string) {
    return this.kbService.getArticleFeedback(id);
  }

  // ─── TAGS ──────────────────────────────────────────────────────────────────

  @Post('tags')
  @ApiOperation({ summary: 'Create a knowledge base tag' })
  createTag(@Body() dto: CreateKbTagDto) {
    return this.kbService.createTag(dto);
  }

  @Public()
  @Get('tags')
  @ApiOperation({ summary: 'List knowledge base tags' })
  getTags(@Query() query: QueryKbTagsDto) {
    return this.kbService.getTags(query);
  }
}
