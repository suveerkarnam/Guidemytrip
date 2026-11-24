import { app } from "./app.js";
import { config } from "./config.js";

app.listen(config.API_PORT, () => {
  console.log(`GuideMyTrip API listening on port ${config.API_PORT}`);
});
