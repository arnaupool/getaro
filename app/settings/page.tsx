import { updateProfile } from "@/app/actions";
import { ActionForm, SubmitButton } from "@/components/forms";
import { ThemeSelect } from "@/components/ThemeToggle";
import { requireProfile } from "@/lib/auth";
import { getI18n } from "@/lib/i18n/server";
import { ColorPicker } from "./ColorPicker";

export default async function SettingsPage() {
  const me = await requireProfile();
  const { t } = await getI18n();

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <h1 className="text-2xl font-bold">{t.settings.title}</h1>

      <ActionForm action={updateProfile} className="card space-y-4">
        <h2 className="font-semibold">{t.settings.profile}</h2>
        <div>
          <label className="label" htmlFor="display_name">
            {t.settings.displayName}
          </label>
          <input
            id="display_name"
            name="display_name"
            required
            maxLength={40}
            defaultValue={me.display_name}
            className="input"
          />
        </div>
        <fieldset>
          <legend className="label">{t.settings.gender}</legend>
          <div className="flex flex-wrap gap-2">
            {(["f", "m", "n"] as const).map((g) => (
              <label
                key={g}
                className="flex cursor-pointer items-center gap-2 rounded-xl border border-zinc-300 px-3 py-2 text-sm has-checked:border-violet-600 has-checked:bg-violet-50 dark:border-zinc-700 dark:has-checked:bg-violet-950/40"
              >
                <input
                  type="radio"
                  name="gender"
                  value={g}
                  defaultChecked={(me.gender ?? "n") === g}
                  className="accent-violet-600"
                />
                {t.settings.genders[g]}
              </label>
            ))}
          </div>
        </fieldset>
        <div>
          <span className="label">{t.settings.color}</span>
          <ColorPicker name="color" defaultValue={me.color} />
        </div>
        <SubmitButton pendingText={t.common.saving}>{t.common.save}</SubmitButton>
      </ActionForm>

      <section className="card space-y-3">
        <h2 className="font-semibold">{t.settings.appearance}</h2>
        <ThemeSelect />
      </section>
    </div>
  );
}
