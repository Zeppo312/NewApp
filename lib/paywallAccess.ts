import { supabase } from './supabase';

export type PaywallAccessRole = 'tester' | 'cooperation_partner';
export type PaywallAccessReason =
  | 'subscription'
  | 'admin'
  | PaywallAccessRole
  | 'none';

export type PaywallAccessAdminUser = {
  user_id: string;
  email: string | null;
  first_name: string | null;
  last_name: string | null;
  username: string | null;
  is_admin: boolean | null;
  paywall_access_role: PaywallAccessRole | null;
  has_profile: boolean | null;
};

export const isPaywallAccessRole = (
  value: string | null | undefined,
): value is PaywallAccessRole =>
  value === 'tester' || value === 'cooperation_partner';

export const getPaywallAccessRoleLabel = (
  role: PaywallAccessRole | null | undefined,
): string => {
  switch (role) {
    case 'tester':
      return 'Tester';
    case 'cooperation_partner':
      return 'Kooperationspartner';
    default:
      return 'Kein Sonderzugang';
  }
};

export const getPaywallAccessReasonLabel = (
  reason: PaywallAccessReason,
): string => {
  switch (reason) {
    case 'subscription':
      return 'Abo';
    case 'admin':
      return 'Admin';
    case 'tester':
      return 'Tester';
    case 'cooperation_partner':
      return 'Kooperationspartner';
    default:
      return 'Kein aktiver Zugang';
  }
};

export const searchPaywallAccessUsers = async (
  searchText: string,
): Promise<PaywallAccessAdminUser[]> => {
  const { data, error } = await supabase.rpc(
    'admin_search_paywall_access_users',
    { search_text: searchText },
  );

  if (error) {
    throw error;
  }

  return (data ?? []) as PaywallAccessAdminUser[];
};

export const setUserPaywallAccessRole = async (
  userId: string,
  role: PaywallAccessRole | null,
): Promise<{ user_id: string; paywall_access_role: PaywallAccessRole | null }> => {
  const { data, error } = await supabase.rpc(
    'admin_set_paywall_access_role',
    {
      target_user_id: userId,
      new_role: role,
    },
  );

  if (error) {
    throw error;
  }

  const row = Array.isArray(data) ? data[0] : data;
  return {
    user_id: row?.user_id as string,
    paywall_access_role: isPaywallAccessRole(row?.paywall_access_role)
      ? row.paywall_access_role
      : null,
  };
};
