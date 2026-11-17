/**
 * Sends accountant messages queued by the PNY till in S_EmailOutbox.
 * Set PNY_EMAIL_SHEET_ID in Script Properties, then run installPnyEmailTrigger once.
 */
function processPnyEmailOutbox() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return;
  try {
    var id = PropertiesService.getScriptProperties().getProperty('PNY_EMAIL_SHEET_ID');
    if (!id) throw new Error('PNY_EMAIL_SHEET_ID is not configured.');
    var sheet = SpreadsheetApp.openById(id).getSheetByName('S_EmailOutbox');
    if (!sheet || sheet.getLastRow() < 2) return;
    var values = sheet.getDataRange().getValues();
    var headers = values[0].map(String);
    var col = {};
    headers.forEach(function (name, index) { col[name] = index; });
    ['row_id', 'to', 'subject', 'body', 'status', 'sent_at', 'last_error'].forEach(function (name) {
      if (col[name] === undefined) throw new Error('Missing S_EmailOutbox column: ' + name);
    });
    for (var rowIndex = 1; rowIndex < values.length; rowIndex += 1) {
      var row = values[rowIndex];
      if (String(row[col.status]).toUpperCase() !== 'PENDING') continue;
      var rowId = String(row[col.row_id]);
      var subject = String(row[col.subject]);
      var marker = '[PNY-EMAIL-ID:' + rowId + ']';
      try {
        var alreadySent = GmailApp.search('in:sent subject:"' + subject.replace(/"/g, '') + '" "' + marker + '"', 0, 1).length > 0;
        if (!alreadySent) {
          MailApp.sendEmail({
            to: String(row[col.to]),
            cc: col.cc === undefined ? '' : String(row[col.cc]),
            subject: subject,
            body: String(row[col.body]) + '\n\n' + marker,
            name: 'PNY POS',
          });
        }
        sheet.getRange(rowIndex + 1, col.status + 1).setValue('SENT');
        sheet.getRange(rowIndex + 1, col.sent_at + 1).setValue(new Date());
        sheet.getRange(rowIndex + 1, col.last_error + 1).clearContent();
      } catch (error) {
        sheet.getRange(rowIndex + 1, col.last_error + 1).setValue(String(error));
      }
    }
  } finally {
    lock.releaseLock();
  }
}

function installPnyEmailTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === 'processPnyEmailOutbox') ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger('processPnyEmailOutbox').timeBased().everyMinutes(1).create();
}

/**
 * Direct sender used by the production till. Deploy this project as a web app
 * that executes as the owner and is accessible to anyone. The shared secret
 * must be stored in Script Properties as PNY_EMAIL_WEBHOOK_SECRET.
 */
function doPost(event) {
  try {
    var payload = JSON.parse((event && event.postData && event.postData.contents) || '{}');
    var expected = PropertiesService.getScriptProperties().getProperty('PNY_EMAIL_WEBHOOK_SECRET');
    if (!expected || String(payload.secret || '') !== expected) return pnyEmailJson_({ ok: false, error: 'Unauthorized' });
    ['row_id', 'to', 'subject', 'body'].forEach(function (name) {
      if (!String(payload[name] || '').trim()) throw new Error('Missing email field: ' + name);
    });
    var marker = '[PNY-EMAIL-ID:' + String(payload.row_id) + ']';
    var subject = String(payload.subject);
    var alreadySent = GmailApp.search('in:sent subject:"' + subject.replace(/"/g, '') + '" "' + marker + '"', 0, 1).length > 0;
    if (!alreadySent) {
      MailApp.sendEmail({
        to: String(payload.to),
        cc: String(payload.cc || ''),
        subject: subject,
        body: String(payload.body) + '\n\n' + marker,
        name: 'PNY POS',
      });
    }
    return pnyEmailJson_({ ok: true, duplicate: alreadySent });
  } catch (error) {
    return pnyEmailJson_({ ok: false, error: String(error) });
  }
}

function pnyEmailJson_(value) {
  return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);
}
