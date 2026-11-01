export type LoginAttempt = {
  action: string;
  targetRef: string | null;
  details: { ip?: string } | null;
  createdAt: Date;
};

export function countRecentFailedLogins(
  attempts: LoginAttempt[],
  ip: string,
  email: string,
  since: Date,
): { ipCount: number; emailCount: number } {
  const failures = attempts.filter(
    (attempt) => attempt.action === 'login_failed' && attempt.createdAt >= since,
  );
  return {
    ipCount: failures.filter((attempt) => attempt.details?.ip === ip).length,
    emailCount: failures.filter((attempt) => attempt.targetRef === email).length,
  };
}

export function shouldBlockLogin(ipCount: number, emailCount: number): boolean {
  return ipCount >= 5 || emailCount >= 5;
}
