export const generateSubject = (name: string, date: string) => {
  return `${name} - daily updates - ${new Date(date).toLocaleDateString(
    "en-US",
    {
      month: "long",
      year: "numeric",
      day: "numeric",
    },
  )}`;
};

export const decodeHtmlEntities = (str: string): string => {
  if (!str) return "";
  return str
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'");
};
