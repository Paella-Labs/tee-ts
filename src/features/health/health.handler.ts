import type { AppContext } from "../../types";

export const getHealthStatus = async (c: AppContext) => {
  console.log("[Health] OK");
  return c.json({ status: "healthy" });
};
