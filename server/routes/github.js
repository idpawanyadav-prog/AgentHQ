const express = require('express');
const router = express.Router();
const { Octokit } = require('@octokit/rest');
const prisma = require('../prisma');
const { broadcastActivity } = require('../socket');

function withAuth(req, res, next) {
 if (!req.user) return res.status(401).json({ error: 'Authentication required' });
 return next();
}
router.use(withAuth);

const octokit = new Octokit({
 auth: process.env.GITHUB_PERSONAL_ACCESS_TOKEN, // Optional for public repos
});

// ─── Get repo info ────────────────────────────────────────────────────────────
router.get('/repo', async (req, res) => {
 try {
 const { owner, repo } = req.query;

 if (!owner || !repo) {
 return res.status(400).json({ error: 'owner and repo query params required' });
 }

 const { data } = await octokit.repos.get({ owner, repo });

 res.json({
 fullName: data.full_name,
 description: data.description,
 htmlUrl: data.html_url,
 defaultBranch: data.default_branch,
 stargazersCount: data.stargazers_count,
 forksCount: data.forks_count,
 openIssuesCount: data.open_issues_count,
 updatedAt: data.updated_at,
 });
 } catch (err) {
 console.error('[GitHub /repo]', err.message);
 res.status(500).json({ error: 'Failed to fetch repo info' });
 }
});

// ─── List open PRs ────────────────────────────────────────────────────────────
router.get('/pulls', async (req, res) => {
 try {
 const { owner, repo, state, perPage, page } = req.query;

 if (!owner || !repo) {
 return res.status(400).json({ error: 'owner and repo query params required' });
 }

 const { data } = await octokit.pulls.list({
 owner,
 repo: String(repo),
 state: String(state) || 'open',
 per_page: Math.min(parseInt(String(perPage) || '30', 10), 100),
 page: parseInt(String(page) || '1', 10),
 });

 const pulls = data.map((pr) => ({
 number: pr.number,
 title: pr.title,
 htmlUrl: pr.html_url,
 state: pr.state,
 merged: pr.merged,
 mergeable: pr.mergeable,
 author: pr.user?.login,
 headRef: pr.head?.ref,
 baseRef: pr.base?.ref,
 createdAt: pr.created_at,
 updatedAt: pr.updated_at,
 }));

 res.json(pulls);
 } catch (err) {
 console.error('[GitHub /pulls]', err.message);
 res.status(500).json({ error: 'Failed to fetch pull requests' });
 }
});

// ─── List commits ─────────────────────────────────────────────────────────────
router.get('/commits', async (req, res) => {
 try {
 const { owner, repo, sha, perPage, page } = req.query;

 if (!owner || !repo) {
 return res.status(400).json({ error: 'owner and repo query params required' });
 }

 const { data } = await octokit.repos.listCommits({
 owner,
 repo: String(repo),
 sha: String(sha),
 per_page: Math.min(parseInt(String(perPage) || '30', 10), 100),
 page: parseInt(String(page) || '1', 10),
 });

 const commits = data.map((commit) => ({
 sha: commit.sha,
 message: commit.commit?.message?.split('\n')[0],
 author: commit.commit?.author?.name,
 date: commit.commit?.author?.date,
 htmlUrl: commit.html_url,
 }));

 res.json(commits);
 } catch (err) {
 console.error('[GitHub /commits]', err.message);
 res.status(500).json({ error: 'Failed to fetch commits' });
 }
});

// ─── GitHub webhook receiver ──────────────────────────────────────────────────
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
 try {
 const event = req.headers['x-github-event'];
 const payload = JSON.parse(req.body);

 // Find or create a default team for webhook events (single-tenant MVP)
 const defaultTeam = await prisma.team.findFirst();

 let activityType = 'github_event';
 let description = `GitHub ${event} event received`;

 if (event === 'push') {
 activityType = 'commit';
 description = `Push to ${payload.ref?.replace('refs/heads/', '')}: ${payload.head_commit?.message?.slice(0, 120) || ''}`;
 } else if (event === 'pull_request') {
 if (payload.action === 'opened') {
 activityType = 'pr_opened';
 description = `PR #${payload.number}: ${payload.pull_request?.title || ''}`;
 } else if (payload.action === 'closed' && payload.pull_request?.merged) {
 activityType = 'pr_merged';
 description = `PR #${payload.number} merged`;
 }
 } else if (event === 'issues') {
 activityType = 'issue_opened';
 description = `Issue #${payload.issue?.number}: ${payload.issue?.title || ''}`;
 } else if (event === 'check_suite') {
 activityType = 'ci_status';
 description = `CI ${payload.check_suite?.conclusion || payload.check_suite?.status}: ${payload.check_suite?.head_commit?.message?.slice(0, 80) || ''}`;
 }

 if (defaultTeam) {
 const activity = await prisma.activity.create({
 data: {
 type: activityType,
 description,
 meta: JSON.stringify(payload),
 teamId: defaultTeam.id,
 },
 });

 broadcastActivity(activity);
 }

 res.status(200).json({ received: true });
 } catch (err) {
 console.error('[GitHub /webhook]', err);
 res.status(400).json({ error: 'Webhook processing failed' });
 }
});

module.exports = router;
