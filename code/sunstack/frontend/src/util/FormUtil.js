export const sanitizePhoneNumber = (value) => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("0") ? digits : "";
};
