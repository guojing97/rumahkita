export interface UserProfile {
  id: string;
  email: string;
  fullName: string;
  phoneNumber?: string | null;
  isActive: boolean;
}

export interface HouseholdSummary {
  id: string;
  name: string;
  role: 'owner' | 'member';
  currency?: string;
  timezone?: string;
}

export interface AuthState {
  user: UserProfile | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

export interface HouseholdState {
  activeHousehold: HouseholdSummary | null;
  households: HouseholdSummary[];
  isOwner: boolean;
  isLoading: boolean;
}
