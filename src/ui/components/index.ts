import type { ComponentType } from "react";
import type { A2UIComponentProps } from "../types";
import { StatCard } from "./StatCard";
import { ComparisonTable } from "./ComparisonTable";
import { SliderControl } from "./SliderControl";
import { ExplanationCard } from "./ExplanationCard";
import { ActionConfirmationModal } from "./ActionConfirmationModal";
import { ScheduleList } from "./ScheduleList";
import { SuggestionChips } from "./SuggestionChips";

// Catálogo — docs/A2UI.md sección 4. Siete, no se agregan sin ADR.
export const COMPONENTS: Record<string, ComponentType<A2UIComponentProps>> = {
  StatCard,
  ComparisonTable,
  SliderControl,
  ExplanationCard,
  ActionConfirmationModal,
  ScheduleList,
  SuggestionChips,
};
