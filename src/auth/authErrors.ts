export function toFriendlyAuthError(error: unknown): string {
  const message = typeof error === 'string' ? error : error instanceof Error ? error.message : '';
  if (/invalid login credentials/i.test(message)) return '邮箱或密码错误，请核对后重试。';
  if (/email not confirmed/i.test(message)) return '邮箱尚未验证，请先点击注册邮件中的验证链接，再登录。';
  if (/failed to fetch|fetch failed|network|load failed|connection|timeout|timed out|abort/i.test(message)) {
    return '暂时无法连接登录服务。请切换网络后重试；若持续失败，需要检查云端项目是否正常运行。本地词库仍可使用。';
  }
  if (/rate limit|too many|security purposes/i.test(message)) return '请求过于频繁，请稍后再试。';
  if (/email provider disabled|signups not allowed/i.test(message)) return '当前云端未开放此登录或注册方式。';
  if (/already registered/i.test(message)) return '这个邮箱已注册，请切换到登录。';
  if (/password.*(least|short|weak)/i.test(message)) return '密码不符合要求，请使用至少 6 位的更强密码。';
  if (/invalid.*email|email.*invalid/i.test(message)) return '邮箱格式不正确，请检查后重试。';
  if (/invalid api key|invalid.*jwt/i.test(message)) return '登录服务配置异常，需要检查云端连接配置。';
  return '登录服务返回异常，请稍后重试；若持续出现，请反馈发生时间以便排查。';
}
