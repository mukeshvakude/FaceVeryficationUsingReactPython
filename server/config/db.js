import { initUserStore } from "../utils/userStore.js";

export const connectDb = async () => {
  await initUserStore();
};
