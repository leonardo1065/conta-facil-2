import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { currentUserId } from "./finance";
import type { DailyValue } from "./daily-history";

export function useDailyValues() {
  return useQuery({
    queryKey: ["daily-values"],
    queryFn: async (): Promise<DailyValue[]> => {
      const userId = await currentUserId();
      const result: DailyValue[] = [];
      for (let offset = 0; ; offset += 1000) {
        const { data, error } = await supabase.from("daily_value_history")
          .select("id, entry_id, amount, added_at").eq("user_id", userId)
          .order("added_at").order("id").range(offset, offset + 999);
        if (error) throw error;
        result.push(...(data ?? []).map((item) => ({ ...item, amount: Number(item.amount) })));
        if ((data?.length ?? 0) < 1000) return result;
      }
    },
  });
}