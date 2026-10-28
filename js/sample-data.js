// Demonstration records. Every record is flagged sample:true by the store on import,
// and the UI labels them "Sample". Nothing here describes real project state.
export function getSampleRecords(now = new Date()) {
  const ago = (hours) => new Date(now.getTime() - hours * 3600 * 1000).toISOString();
  const day = (offset) => new Date(now.getTime() + offset * 86400000).toISOString().slice(0, 10);
  const meta = (h) => ({ createdAt: ago(h), updatedAt: ago(h) });

  return {
    projects: [
      { id: 'sample-p-leadforge', name: 'Devign Lead Forge', state: 'active', purpose: 'Lead-management application and primary CRM.', constraints: 'Iris references its records; it does not duplicate the CRM.', lastImplementation: 'Sample: prospect list filters.', blockers: '', nextAction: 'Sample: review follow-up reminders.', ...meta(72) },
      { id: 'sample-p-iris', name: 'Devign Iris', state: 'active', purpose: 'Command centre for Devign projects and AI tools.', constraints: 'Vanilla HTML, CSS, and JavaScript. No paid services yet.', lastImplementation: 'Sample: Iris Shell layout.', blockers: '', nextAction: 'Sample: continue in Replit.', ...meta(48) },
      { id: 'sample-p-portal', name: 'Devign Client Portal', state: 'blocked', purpose: 'Client-facing portal for deliverables and invoices.', constraints: '', lastImplementation: '', blockers: 'Sample: waiting on a decision about how clients sign in.', nextAction: 'Sample: decide on the sign-in approach.', ...meta(96) }
    ],
    agents: [
      { id: 'sample-a-claude', name: 'Claude', provider: 'Anthropic', capabilities: 'Writes and reviews code in chat sessions.', limitations: 'Cannot see the repository unless files are shared.', projectId: 'sample-p-iris', assignment: 'Build the Iris Shell.', status: 'assigned', lastActivity: '', lastReported: '', pendingHandover: '', verification: 'Not verified', ...meta(48) },
      { id: 'sample-a-replit', name: 'Replit Agent', provider: 'Replit', capabilities: 'Edits and runs code inside Replit.', limitations: '', projectId: '', assignment: '', status: 'registered', lastActivity: '', lastReported: '', pendingHandover: '', verification: 'Not verified', ...meta(24) }
    ],
    activity: [
      { id: 'sample-e-1', projectId: 'sample-p-iris', actor: 'Claude', objective: 'Initial shell', evidence: 'reported', summary: 'Sample: shell layout reported complete.', files: '', tests: '', commit: '', deployment: '', issues: 'Not verified.', nextAction: 'Run checks.', timestamp: ago(40), ...meta(40) },
      { id: 'sample-e-2', projectId: 'sample-p-leadforge', actor: 'Founder', objective: 'Filter bug', evidence: 'tested', summary: 'Sample: filter fix tested by hand.', files: 'Sample: filters.js', tests: 'Sample: manual check on phone', commit: '', deployment: '', issues: '', nextAction: 'Deploy after review.', timestamp: ago(30), ...meta(30) },
      { id: 'sample-e-3', projectId: 'sample-p-portal', actor: '', objective: 'Sign-in design', evidence: 'planned', summary: 'Sample: sign-in options drafted, nothing built.', files: '', tests: '', commit: '', deployment: '', issues: 'Needs a decision.', nextAction: '', timestamp: ago(90), ...meta(90) }
    ],
    tasks: [
      { id: 'sample-t-1', title: 'Follow up with sample prospect', projectId: 'sample-p-leadforge', priority: 'high', due: day(-1), status: 'open', notes: '', ...meta(20) },
      { id: 'sample-t-2', title: 'Choose client sign-in approach', projectId: 'sample-p-portal', priority: 'medium', due: day(5), status: 'open', notes: '', ...meta(20) },
      { id: 'sample-t-3', title: 'Move Iris to Replit', projectId: 'sample-p-iris', priority: 'low', due: '', status: 'done', notes: '', ...meta(10) }
    ]
  };
}
