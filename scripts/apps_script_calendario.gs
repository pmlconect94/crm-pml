/**
 * Apps Script (Google) — puente Gmail -> Drive para el Calendario de llegadas.
 *
 * Guarda los PDF "Calendario de llegadas" que manda Alfonso Gutiérrez
 * (alfonso.gutierrez@menita.com.mx, martes y viernes) en la carpeta de Drive
 * "Calendario Menita CRM", de donde la rutina del CRM (tarea `calendario-menita`)
 * los lee y sincroniza contenedor/naviera/ETA con los contratos.
 *
 * SETUP (una sola vez, en https://script.google.com con la cuenta ddl.pml2@gmail.com):
 *   1) Pega esta función en el proyecto de Apps Script (puede ser el mismo donde
 *      vive `guardarFacturasMenita`, o uno nuevo).
 *   2) Ejecuta `guardarCalendarioMenita` una vez y autoriza los permisos
 *      (Gmail de solo lectura + Drive). Eso baja los calendarios recientes.
 *   3) Agrega un activador (Triggers / ⏰): función `guardarCalendarioMenita`,
 *      por tiempo, cada hora (o cada 2-4 h). Así el calendario aterriza en Drive
 *      poco después de que llegue el correo.
 *
 * Es idempotente: no vuelve a guardar un PDF cuyo nombre ya esté en la carpeta.
 */
function guardarCalendarioMenita() {
  var FOLDER_ID = '19WhqL_qQm1Z6CAru9IdjPYzEh1PuIRgN'; // "Calendario Menita CRM"
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var query = 'from:alfonso.gutierrez@menita.com.mx subject:Calendario has:attachment newer_than:30d';

  var threads = GmailApp.search(query, 0, 50);
  var guardados = 0;
  for (var t = 0; t < threads.length; t++) {
    var msgs = threads[t].getMessages();
    for (var m = 0; m < msgs.length; m++) {
      var atts = msgs[m].getAttachments();
      for (var a = 0; a < atts.length; a++) {
        var att = atts[a];
        var name = att.getName();
        // Solo el PDF del calendario (descarta la imagen de la firma, etc.).
        if (att.getContentType() !== 'application/pdf') continue;
        if (name.toLowerCase().indexOf('calendario') !== 0) continue;
        // Idempotente: si ya existe un archivo con ese nombre, no lo dupliques.
        if (folder.getFilesByName(name).hasNext()) continue;
        folder.createFile(att.copyBlob()).setName(name);
        guardados++;
      }
    }
  }
  Logger.log('Calendarios nuevos guardados en Drive: ' + guardados);
}
