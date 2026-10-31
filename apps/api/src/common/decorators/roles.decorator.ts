import { SetMetadata } from '@nestjs/common';
import { ROLES_KEY } from '../constants/tokens.js';

export const Roles = (...roles: ('owner' | 'member')[]) => SetMetadata(ROLES_KEY, roles);
