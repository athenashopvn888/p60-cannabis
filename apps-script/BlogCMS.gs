/**
 * ============================================================
 *   Blog CMS — Apps Script Addition
 *   Paste this at the END of your existing Code.gs
 * ============================================================
 * 
 * Adds blog CRUD endpoints to the existing web app.
 * Uses a "Blog" sheet in the same AthenaWebsiteMaster spreadsheet.
 * 
 * SETUP:
 *   1. Create a "Blog" sheet in your spreadsheet with headers:
 *      id | title | slug | content | author | date | published | store
 *   2. Paste this code at the end of Code.gs
 *   3. Save & re-deploy the web app (New deployment)
 * ============================================================
 */


// ── Blog Sheet Helpers ──

function getBlogSheet_() {
  var sheetId = getConfig_('MASTER_SHEET_ID');
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName('Blog');
  
  // Auto-create Blog sheet if it doesn't exist
  if (!sheet) {
    sheet = ss.insertSheet('Blog');
    sheet.appendRow(['id', 'title', 'slug', 'content', 'author', 'date', 'published', 'store']);
    sheet.setFrozenRows(1);
  }
  
  return sheet;
}

function getBlogPosts_(store, includeUnpublished) {
  var sheet = getBlogSheet_();
  var data = sheet.getDataRange().getValues();
  if (data.length <= 1) return []; // Just headers
  
  var headers = data[0];
  var posts = [];
  
  for (var i = 1; i < data.length; i++) {
    var row = {};
    for (var j = 0; j < headers.length; j++) {
      row[headers[j]] = data[i][j];
    }
    
    // Filter by store
    if (store && String(row.store).toUpperCase() !== store.toUpperCase()) continue;
    
    // Filter unpublished unless admin
    if (!includeUnpublished && String(row.published).toUpperCase() !== 'TRUE') continue;
    
    row.rowIndex = i + 1; // 1-based sheet row
    posts.push(row);
  }
  
  // Sort by date descending
  posts.sort(function(a, b) {
    return new Date(b.date) - new Date(a.date);
  });
  
  return posts;
}

function createBlogPost_(data) {
  var sheet = getBlogSheet_();
  var id = 'blog_' + Date.now();
  var slug = slugify_(data.title || 'untitled');
  var date = data.date || new Date().toISOString();
  var published = data.published === true || data.published === 'true' ? 'TRUE' : 'FALSE';
  
  sheet.appendRow([
    id,
    data.title || '',
    slug,
    data.content || '',
    data.author || 'Admin',
    date,
    published,
    data.store || 'SCC01'
  ]);
  
  return { id: id, slug: slug, success: true };
}

function updateBlogPost_(data) {
  var sheet = getBlogSheet_();
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  
  var idCol = headers.indexOf('id');
  if (idCol === -1) return { success: false, error: 'No id column' };
  
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(data.id)) {
      var row = i + 1; // 1-based
      
      // Update fields
      if (data.title !== undefined) sheet.getRange(row, headers.indexOf('title') + 1).setValue(data.title);
      if (data.slug !== undefined) sheet.getRange(row, headers.indexOf('slug') + 1).setValue(data.slug);
      if (data.content !== undefined) sheet.getRange(row, headers.indexOf('content') + 1).setValue(data.content);
      if (data.author !== undefined) sheet.getRange(row, headers.indexOf('author') + 1).setValue(data.author);
      if (data.published !== undefined) {
        var pub = data.published === true || data.published === 'true' ? 'TRUE' : 'FALSE';
        sheet.getRange(row, headers.indexOf('published') + 1).setValue(pub);
      }
      
      return { success: true, id: data.id };
    }
  }
  
  return { success: false, error: 'Post not found: ' + data.id };
}

function deleteBlogPost_(id) {
  var sheet = getBlogSheet_();
  var allData = sheet.getDataRange().getValues();
  var headers = allData[0];
  var idCol = headers.indexOf('id');
  
  for (var i = 1; i < allData.length; i++) {
    if (String(allData[i][idCol]) === String(id)) {
      sheet.deleteRow(i + 1);
      return { success: true };
    }
  }
  
  return { success: false, error: 'Post not found' };
}


// ── Delivery Email Collection ──

function saveDeliveryEmail_(email, store) {
  var sheetId = getConfig_('MASTER_SHEET_ID');
  var ss = SpreadsheetApp.openById(sheetId);
  var sheet = ss.getSheetByName('DeliveryEmails');
  
  if (!sheet) {
    sheet = ss.insertSheet('DeliveryEmails');
    sheet.appendRow(['email', 'store', 'date']);
    sheet.setFrozenRows(1);
  }
  
  sheet.appendRow([email, store || 'SCC01', new Date().toISOString()]);
  return { success: true };
}
