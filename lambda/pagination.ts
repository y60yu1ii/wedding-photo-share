export function encodeCursor(value: Record<string, any> | undefined): string | undefined {
  if (!value || Object.keys(value).length === 0) return undefined;
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
}

export function decodeCursor(value: string | undefined | null): Record<string, any> | undefined {
  if (!value) return undefined;
  try {
    return JSON.parse(Buffer.from(value, "base64url").toString("utf8"));
  } catch {
    return undefined;
  }
}
