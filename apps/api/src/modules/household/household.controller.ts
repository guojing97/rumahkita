import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { HouseholdService } from './household.service.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { CurrentHouseholdId } from '../../common/decorators/current-household.decorator.js';
import { Roles } from '../../common/decorators/roles.decorator.js';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe.js';
import { inviteMemberSchema, InviteMemberInput } from '@rumahkita/contracts';

@ApiTags('Household')
@Controller()
export class HouseholdController {
  constructor(private readonly householdService: HouseholdService) {}

  @Get('household')
  @ApiOperation({ summary: 'Get current active household profile and members' })
  async getCurrentHousehold(@CurrentHouseholdId() householdId: string) {
    const data = await this.householdService.getCurrentHousehold(householdId);
    return {
      success: true,
      data,
    };
  }

  @Put('household')
  @Roles('owner')
  @ApiOperation({ summary: 'Update active household settings' })
  async updateCurrentHousehold(
    @CurrentHouseholdId() householdId: string,
    @Body() body: { name?: string; currency?: string; timezone?: string }
  ) {
    const data = await this.householdService.updateHousehold(householdId, body);
    return {
      success: true,
      data,
      message: 'Rumah tangga berhasil diperbarui',
    };
  }

  @Get('households')
  @ApiOperation({ summary: 'List user households' })
  async getUserHouseholds(@CurrentUser('id') userId: string) {
    const data = await this.householdService.getUserHouseholds(userId);
    return {
      success: true,
      data,
    };
  }

  @Post('households')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create new household' })
  async createHousehold(
    @CurrentUser('id') userId: string,
    @Body() body: { name: string; currency?: string; timezone?: string }
  ) {
    const data = await this.householdService.createHousehold(userId, body);
    return {
      success: true,
      data,
      message: 'Rumah tangga berhasil dibuat',
    };
  }

  @Get('households/:id')
  @ApiOperation({ summary: 'Get household by ID' })
  async getHouseholdById(@Param('id') id: string) {
    const data = await this.householdService.getCurrentHousehold(id);
    return {
      success: true,
      data,
    };
  }

  @Put('households/:id')
  @Roles('owner')
  @ApiOperation({ summary: 'Update household by ID' })
  async updateHousehold(
    @Param('id') id: string,
    @Body() body: { name?: string; currency?: string; timezone?: string }
  ) {
    const data = await this.householdService.updateHousehold(id, body);
    return {
      success: true,
      data,
      message: 'Rumah tangga berhasil diperbarui',
    };
  }

  @Get('households/:id/members')
  @ApiOperation({ summary: 'List members of household' })
  async getMembers(@Param('id') id: string) {
    const data = await this.householdService.getMembers(id);
    return {
      success: true,
      data,
    };
  }

  @Post(['households/:id/invite', 'households/:id/members'])
  @Roles('owner')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Invite/add member to household' })
  async inviteMember(
    @Param('id') id: string,
    @Body(new ZodValidationPipe(inviteMemberSchema)) body: InviteMemberInput
  ) {
    const data = await this.householdService.inviteMember(id, body);
    return {
      success: true,
      data,
      message: 'Anggota berhasil ditambahkan',
    };
  }

  @Delete('households/:id/members/:memberId')
  @Roles('owner')
  @ApiOperation({ summary: 'Remove member from household' })
  async removeMember(
    @Param('id') id: string,
    @Param('memberId') memberId: string
  ) {
    await this.householdService.removeMember(id, memberId);
    return {
      success: true,
      data: null,
      message: 'Anggota berhasil dihapus',
    };
  }
}
