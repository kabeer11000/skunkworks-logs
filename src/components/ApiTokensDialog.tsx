import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { X } from 'lucide-react'
import { listApiTokens, createApiToken, revokeApiToken, type ApiToken } from '@/services/apiTokens'

function mcpConfigSnippet(origin: string, token: string) {
  return JSON.stringify(
    {
      mcpServers: {
        'skunkworks-logs': {
          command: 'node',
          args: ['/absolute/path/to/mcp-server/index.js'],
          env: { SKUNKWORKS_API_URL: origin, SKUNKWORKS_API_TOKEN: token },
        },
      },
    },
    null,
    2
  )
}

// Account-level, not drain-scoped — used by external agents/tools (the MCP
// server) via Authorization: Bearer <token>, with the same read/write
// permissions as the signed-in account itself (except editing/deleting an
// entry, which stays author-only — see api/drains/[dbName]/entries*.ts).
export function ApiTokensDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const [tokens, setTokens] = useState<ApiToken[]>([])
  const [newName, setNewName] = useState('')
  const [creating, setCreating] = useState(false)
  const [justCreated, setJustCreated] = useState<string | null>(null)
  const [error, setError] = useState('')
  const origin = typeof window !== 'undefined' ? window.location.origin : ''

  useEffect(() => {
    if (!open) return
    listApiTokens().then(setTokens).catch(() => setTokens([]))
  }, [open])

  const handleCreate = async () => {
    setCreating(true)
    setError('')
    try {
      const token = await createApiToken(newName.trim() || 'Unnamed token')
      setJustCreated(token)
      setNewName('')
      setTokens(await listApiTokens())
    } catch (err: any) {
      setError(err?.message ?? 'Failed to create token')
    } finally {
      setCreating(false)
    }
  }

  const handleRevoke = async (token: string) => {
    setTokens((prev) => prev.filter((t) => t.token !== token))
    try {
      await revokeApiToken(token)
    } catch {
      setTokens(await listApiTokens().catch(() => []))
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>API tokens</DialogTitle>
          <DialogDescription>
            Lets an AI agent (Claude Desktop, Claude Code, or anything else speaking MCP) read and write your drains
            directly — same access as signing in yourself, except it can only edit or delete entries it originally
            created, not anyone else's.
          </DialogDescription>
        </DialogHeader>

        {justCreated ? (
          <div className="grid gap-2 rounded-md border border-violet-200 bg-violet-50 p-3">
            <p className="text-xs font-medium text-violet-700">
              Copy this token now — it won't be shown again.
            </p>
            <div className="flex gap-1.5">
              <Input readOnly value={justCreated} onFocus={(e) => e.target.select()} className="font-mono text-xs" />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(justCreated)}
              >
                Copy
              </Button>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              To use it with the MCP server: clone/download the <code>mcp-server</code> folder from the repo, run{' '}
              <code>npm install</code> in it, then add this to your MCP client's config (Claude Desktop's{' '}
              <code>claude_desktop_config.json</code>, or Claude Code's <code>.claude/settings.json</code> under{' '}
              <code>mcpServers</code>) — swap in the real path to <code>index.js</code>:
            </p>
            <div className="flex gap-1.5">
              <pre className="max-h-40 flex-1 overflow-auto rounded-md bg-neutral-900 p-2 text-[10px] text-neutral-100">
                {mcpConfigSnippet(origin, justCreated)}
              </pre>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => navigator.clipboard.writeText(mcpConfigSnippet(origin, justCreated))}
              >
                Copy
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Restart your MCP client after saving the config. Revoking the token below cuts it off immediately.
            </p>
          </div>
        ) : (
          <p className="text-xs text-muted-foreground">
            Create a token, then follow the setup steps shown here to connect it to the MCP server (see this
            project's <code>mcp-server/README.md</code> for the same instructions any time).
          </p>
        )}

        <div className="flex flex-col gap-1.5">
          {tokens.map((t) => (
            <div key={t.token} className="flex items-center justify-between rounded-md bg-muted/50 px-2.5 py-1.5 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{t.name}</div>
                <div className="text-xs text-muted-foreground">
                  Created {new Date(t.createdAt).toLocaleDateString()}
                  {t.lastUsedAt ? ` · Last used ${new Date(t.lastUsedAt).toLocaleDateString()}` : ' · Never used'}
                </div>
              </div>
              <button
                type="button"
                onClick={() => handleRevoke(t.token)}
                className="shrink-0 text-muted-foreground hover:text-destructive"
                title="Revoke"
              >
                <X className="size-3.5" />
              </button>
            </div>
          ))}
          {tokens.length === 0 && (
            <p className="py-2 text-center text-xs text-muted-foreground">No tokens yet.</p>
          )}
        </div>

        <div className="flex gap-1.5">
          <Input
            placeholder="Token name (e.g. Claude Desktop)"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), handleCreate())}
          />
          <Button type="button" variant="outline" onClick={handleCreate} disabled={creating}>
            {creating ? 'Creating…' : 'Create'}
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
