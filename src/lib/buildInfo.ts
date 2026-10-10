const REPO_URL = 'https://github.com/critesjosh/marginalia'

export interface BuildInfo {
  label: string
  url?: string
}

/** Describes the build for display: `a1b2c3d · 2026-10-09`, or `dev` when unknown. */
export function describeBuild(commit: string | undefined, builtAt: string | undefined): BuildInfo {
  const date = builtAt?.slice(0, 10)
  if (!commit) return { label: date ? `dev · ${date}` : 'dev' }
  const sha = commit.replace(/-dirty$/, '')
  return {
    label: date ? `${commit} · ${date}` : commit,
    url: `${REPO_URL}/commit/${sha}`,
  }
}

export const BUILD: BuildInfo = describeBuild(
  import.meta.env.APP_COMMIT as string | undefined,
  import.meta.env.APP_BUILT_AT as string | undefined,
)
