import { operationGuides } from "./operation-guides";
import { settingsGuides } from "./settings-guides";
import { reportGuides } from "./report-guides";

export const helpGuides = {
  ...operationGuides,
  ...settingsGuides,
  ...reportGuides,
};

export type HelpTopic = keyof typeof helpGuides;
