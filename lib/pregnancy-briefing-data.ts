import { supabase } from '@/lib/supabase';
import {
  EMPTY_PREGNANCY_BRIEFING_SIGNALS,
  type PregnancyBriefingSignals,
} from '@/lib/pregnancy-briefing';

type LinkedUserRow = {
  id?: string;
  userId?: string;
  firstName?: string;
};

const getLinkedUsers = async (userId: string): Promise<LinkedUserRow[]> => {
  try {
    const { data, error } = await supabase.rpc('get_due_date_with_linked_users', {
      p_user_id: userId,
    });
    if (error || !data?.success || !Array.isArray(data.linkedUsers)) return [];
    return data.linkedUsers as LinkedUserRow[];
  } catch {
    return [];
  }
};

export const loadPregnancyBriefingSignals = async (
  userId: string,
): Promise<PregnancyBriefingSignals> => {
  const linkedUsers = await getLinkedUsers(userId);
  const ownerIds = [
    userId,
    ...linkedUsers
      .map((entry) => entry.userId ?? entry.id)
      .filter((value): value is string => typeof value === 'string' && value.length > 0),
  ];
  const now = new Date();
  const recentSelfcareStart = new Date(now);
  recentSelfcareStart.setDate(recentSelfcareStart.getDate() - 7);

  try {
    const [selfcareResult, appointmentResult, questionsResult, checklistResult, birthPlanResult] =
      await Promise.all([
        supabase
          .from('selfcare_entries')
          .select('date,mood,sleep_hours,water_intake,exercise_done')
          .eq('user_id', userId)
          .gte('date', recentSelfcareStart.toISOString())
          .lte('date', now.toISOString())
          .order('date', { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('planner_items')
          .select('id,title,start_at,location')
          .in('user_id', ownerIds)
          .eq('entry_type', 'event')
          .gte('start_at', now.toISOString())
          .order('start_at', { ascending: true })
          .limit(1)
          .maybeSingle(),
        supabase
          .from('doctor_questions')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId)
          .eq('is_answered', false),
        supabase
          .from('hospital_checklist')
          .select('is_checked')
          .eq('user_id', userId),
        supabase
          .from('geburtsplan')
          .select('id')
          .eq('user_id', userId)
          .limit(1),
      ]);

    const selfcare = selfcareResult.error ? null : selfcareResult.data;
    const appointment = appointmentResult.error ? null : appointmentResult.data;
    const checklistRows = checklistResult.error ? [] : (checklistResult.data ?? []);
    const partnerFirstName = linkedUsers.find(
      (entry) => typeof entry.firstName === 'string' && entry.firstName.trim().length > 0,
    )?.firstName?.trim() ?? null;

    return {
      latestSelfcare: selfcare
        ? {
          date: String(selfcare.date),
          mood: selfcare.mood ?? null,
          sleepHours: typeof selfcare.sleep_hours === 'number' ? selfcare.sleep_hours : null,
          waterIntake: typeof selfcare.water_intake === 'number' ? selfcare.water_intake : null,
          exerciseDone: typeof selfcare.exercise_done === 'boolean' ? selfcare.exercise_done : null,
        }
        : null,
      nextAppointment: appointment?.start_at
        ? {
          id: String(appointment.id),
          title: String(appointment.title),
          startAt: String(appointment.start_at),
          location: typeof appointment.location === 'string' ? appointment.location : null,
        }
        : null,
      openQuestionCount: questionsResult.error ? 0 : (questionsResult.count ?? 0),
      checklist: {
        checked: checklistRows.filter((entry) => entry.is_checked === true).length,
        total: checklistRows.length,
      },
      hasBirthPlan: !birthPlanResult.error && (birthPlanResult.data?.length ?? 0) > 0,
      partnerFirstName,
    };
  } catch (error) {
    console.error('Pregnancy briefing: failed to load personal signals', error);
    return {
      ...EMPTY_PREGNANCY_BRIEFING_SIGNALS,
      checklist: { ...EMPTY_PREGNANCY_BRIEFING_SIGNALS.checklist },
      partnerFirstName: linkedUsers[0]?.firstName?.trim() || null,
    };
  }
};
