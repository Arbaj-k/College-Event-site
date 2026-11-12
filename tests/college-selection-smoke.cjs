'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const events = fs.readFileSync('js/events.js', 'utf8');
const home = fs.readFileSync('index.html', 'utf8');
const listing = fs.readFileSync('events.html', 'utf8');
const common = fs.readFileSync('js/common.js', 'utf8');

assert.ok(events.includes("const COLLEGE_STORAGE_KEY = 'hapn_selected_college_id'"));
assert.ok(events.includes("localStorage.setItem(COLLEGE_STORAGE_KEY, id)"));
assert.ok(events.includes(".eq('college_id', state.college)"), 'Event list must be queried for the selected college');
assert.ok(events.includes(".eq('college_id', selectedCollege)"), 'Event details must stay within the selected college');
assert.ok(events.includes('Which college are you from?'));
assert.ok(events.includes('Change your college anytime.'));
assert.ok(events.includes("college.name !== 'Legacy / Unassigned'"), 'Placeholder college must not be offered to visitors');
assert.ok(home.includes('id="college-filter"') && listing.includes('id="college-filter"'));
assert.ok(home.includes('js/events.js?v=20261112college2') && listing.includes('js/events.js?v=20261112college2'));
assert.ok(common.includes('initHapnNotifications'), 'Shared non-event features must remain present');
assert.ok(!events.includes("localStorage.clear()"), 'College selection must not clear other site preferences');
console.log('College selection smoke checks passed.');

const auth = fs.readFileSync('js/auth.js', 'utf8');
assert.ok(events.includes("location.pathname.match(/^\\/college\\/([^/]+)\\/?$/i)"), 'Student route must resolve a college slug');
assert.ok(events.includes("'/admin/' + encodeURIComponent(slug) + '/'"), 'Admin link must include selected college slug');
assert.ok(events.includes("collegeEventUrl(ev.id)"), 'Shared event links must retain college context');
assert.ok(auth.includes('isAdmin(data.user.id, expectedCollegeId)'), 'College Admin login must validate the route college');
assert.ok(auth.includes("location.href = '/admin/dashboard/'"), 'Admin login must use a clean dashboard URL');
assert.ok(fs.readFileSync('_redirects', 'utf8').includes('/college/*'), 'College slugs must rewrite to the homepage');
