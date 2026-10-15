import type { PermissionKey } from "../../../../shared/auth";

export interface HelpAccess {
  adminOnly?: boolean;
  permission?: PermissionKey;
}

export interface HelpStep extends HelpAccess {
  title: string;
  description: string;
}

export interface HelpShortcut extends HelpAccess {
  keys: string[];
  description: string;
}

export interface HelpNote extends HelpAccess {
  text: string;
}

export interface HelpGuide {
  title: string;
  description: string;
  steps: HelpStep[];
  notes?: HelpNote[];
  shortcuts?: HelpShortcut[];
}
