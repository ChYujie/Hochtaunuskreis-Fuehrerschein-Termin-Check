import { runCheck } from "./checker.js";

const state = await runCheck({ forceNotify: true });
console.log(JSON.stringify(state, null, 2));
