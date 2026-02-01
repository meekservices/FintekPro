import AgentLayout from "@/components/layout/agent-layout";
import { ThemeSettingsContent } from "@/components/settings/theme-settings-content";
import { Palette } from "lucide-react";

export default function AgentThemeSettings() {
  return (
    <AgentLayout>
      <div className="p-4 md:p-6">
        <div className="mb-6">
          <h1 className="text-2xl font-bold flex items-center gap-3 text-white">
            <Palette className="h-7 w-7 text-blue-400" />
            Theme & Accessibility
          </h1>
          <p className="text-slate-400 mt-1">
            Customize your visual experience for the agent portal
          </p>
        </div>
        
        <div className="bg-slate-800/50 rounded-lg p-4 md:p-6">
          <ThemeSettingsContent showHeader={false} />
        </div>
      </div>
    </AgentLayout>
  );
}
