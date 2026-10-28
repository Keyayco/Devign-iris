// Record shapes, enums, and validation. DOM-free so it can be tested in Node.
export const SCHEMA_VERSION = 1;
export const COLLECTIONS = ['projects', 'agents', 'activity', 'tasks'];

export const PROJECT_STATES = ['unknown', 'not_started', 'active', 'paused', 'blocked', 'done'];
export const AGENT_STATES = ['registered', 'assigned', 'reported_active', 'verified', 'blocked'];
export const EVIDENCE_LEVELS = ['planned', 'reported', 'tested', 'verified', 'deployed', 'failed'];
export const PRIORITIES = ['high', 'medium', 'low'];
export const TASK_STATES = ['open', 'done'];

export const LABELS = {
  unknown: 'Unknown', not_started: 'Not started', active: 'Active', paused: 'Paused', blocked: 'Blocked', done: 'Done',
  registered: 'Registered', assigned: 'Assigned', reported_active: 'Reported active', verified: 'Verified',
  planned: 'Planned', reported: 'Reported', tested: 'Tested', deployed: 'Deployed', failed: 'Failed',
  high: 'High', medium: 'Medium', low: 'Low', open: 'Open'
};
export const label = (v) => LABELS[v] || v;

// Field specs drive both the edit forms and validation.
// type: text | textarea | select | date | project (select of project ids)
export const FIELDS = {
  projects: [
    { name: 'name', label: 'Name', type: 'text', required: true, max: 80 },
    { name: 'purpose', label: 'Purpose', type: 'textarea', max: 600 },
    { name: 'state', label: 'State', type: 'select', options: PROJECT_STATES, default: 'unknown' },
    { name: 'constraints', label: 'Constraints', type: 'textarea', max: 600 },
    { name: 'lastImplementation', label: 'Last known implementation', type: 'textarea', max: 600 },
    { name: 'blockers', label: 'Blockers and known bugs', type: 'textarea', max: 600 },
    { name: 'nextAction', label: 'Next recommended action', type: 'textarea', max: 400 }
  ],
  agents: [
    { name: 'name', label: 'Name', type: 'text', required: true, max: 80 },
    { name: 'provider', label: 'Provider', type: 'text', max: 80 },
    { name: 'capabilities', label: 'Capabilities', type: 'textarea', max: 400 },
    { name: 'limitations', label: 'Limitations', type: 'textarea', max: 400 },
    { name: 'projectId', label: 'Assigned project', type: 'project' },
    { name: 'assignment', label: 'Current assignment', type: 'textarea', max: 400 },
    { name: 'status', label: 'Status', type: 'select', options: AGENT_STATES, default: 'registered' },
    { name: 'lastActivity', label: 'Last activity (as reported)', type: 'text', max: 200 },
    { name: 'lastReported', label: 'Last reported implementation', type: 'textarea', max: 400 },
    { name: 'pendingHandover', label: 'Pending handover', type: 'textarea', max: 400 },
    { name: 'verification', label: 'Verification status', type: 'text', max: 200 }
  ],
  activity: [
    { name: 'summary', label: 'Summary of claimed changes', type: 'textarea', required: true, max: 600 },
    { name: 'projectId', label: 'Project', type: 'project' },
    { name: 'actor', label: 'Agent or human responsible', type: 'text', max: 80 },
    { name: 'objective', label: 'Task or objective', type: 'text', max: 200 },
    { name: 'evidence', label: 'Evidence level', type: 'select', options: EVIDENCE_LEVELS, default: 'reported' },
    { name: 'files', label: 'Files or resources affected', type: 'textarea', max: 400 },
    { name: 'tests', label: 'Tests performed and results', type: 'textarea', max: 400 },
    { name: 'commit', label: 'Commit or revision', type: 'text', max: 80 },
    { name: 'deployment', label: 'Deployment status', type: 'text', max: 120 },
    { name: 'issues', label: 'Outstanding issues', type: 'textarea', max: 400 },
    { name: 'nextAction', label: 'Recommended next action', type: 'textarea', max: 300 }
  ],
  tasks: [
    { name: 'title', label: 'Task', type: 'text', required: true, max: 160 },
    { name: 'projectId', label: 'Project', type: 'project' },
    { name: 'priority', label: 'Priority', type: 'select', options: PRIORITIES, default: 'medium' },
    { name: 'due', label: 'Due date', type: 'date' },
    { name: 'status', label: 'Status', type: 'select', options: TASK_STATES, default: 'open' },
    { name: 'notes', label: 'Notes', type: 'textarea', max: 400 }
  ]
};

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Validate and normalise user input for a collection.
 * Returns { ok, errors: {field: message}, record } where record has only known fields.
 * `projectIds` is the list of existing project ids, used to check references.
 */
export function validate(collection, input, projectIds = []) {
  const specs = FIELDS[collection];
  if (!specs) return { ok: false, errors: { _: `Unknown collection: ${collection}` }, record: null };
  const errors = {};
  const record = {};
  for (const f of specs) {
    let v = input && input[f.name];
    v = typeof v === 'string' ? v.trim() : v == null ? '' : String(v).trim();
    if (!v && f.default) v = f.default;
    if (f.required && !v) errors[f.name] = `${f.label} is required.`;
    if (f.max && v.length > f.max) errors[f.name] = `${f.label} must be ${f.max} characters or fewer.`;
    if (f.type === 'select' && v && !f.options.includes(v)) errors[f.name] = `${f.label} has an unsupported value.`;
    if (f.type === 'date' && v && (!DATE_RE.test(v) || Number.isNaN(Date.parse(v)))) errors[f.name] = `${f.label} must be a valid date.`;
    if (f.type === 'project' && v && !projectIds.includes(v)) errors[f.name] = `${f.label} refers to a project that does not exist.`;
    record[f.name] = v;
  }
  return { ok: Object.keys(errors).length === 0, errors, record };
}

/** Light structural check used when loading stored data. */
export function isStoredState(obj) {
  return !!obj && typeof obj === 'object' && obj.schema === SCHEMA_VERSION &&
    COLLECTIONS.every((c) => Array.isArray(obj[c]));
}
