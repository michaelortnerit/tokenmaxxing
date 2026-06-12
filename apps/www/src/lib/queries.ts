import { queryOptions } from "@tanstack/react-query";
import type { LeaderboardMetric, LeaderboardWindow } from "@tokenmaxxing/api-contract";

import { runApi } from "./api";

/**
 * queryOptions for every server read — components compose these with
 * useQuery/useMutation; query keys are the single source of cache identity.
 */

const meQuery = queryOptions({
  queryKey: ["me"],
  queryFn: () => runApi((client) => client.me.me()),
  retry: false,
  staleTime: 60_000,
});

const devicesQuery = queryOptions({
  queryKey: ["me", "devices"],
  queryFn: () => runApi((client) => client.me.listDevices()),
});

const tokensQuery = queryOptions({
  queryKey: ["me", "tokens"],
  queryFn: () => runApi((client) => client.me.listTokens()),
});

function leaderboardQuery(
  metric: typeof LeaderboardMetric.Type,
  window: typeof LeaderboardWindow.Type,
) {
  return queryOptions({
    queryKey: ["leaderboard", metric, window],
    queryFn: () => runApi((client) => client.leaderboard.list({ query: { metric, window } })),
    staleTime: 30_000,
  });
}

function profileQuery(login: string) {
  return queryOptions({
    queryKey: ["profile", login],
    queryFn: () => runApi((client) => client.profiles.get({ params: { login } })),
    staleTime: 30_000,
  });
}

function profileDailyQuery(login: string) {
  return queryOptions({
    queryKey: ["profile", login, "daily"],
    queryFn: () =>
      runApi((client) => client.profiles.daily({ params: { login }, query: { groupBy: "model" } })),
    staleTime: 30_000,
  });
}

export { devicesQuery, leaderboardQuery, meQuery, profileDailyQuery, profileQuery, tokensQuery };
