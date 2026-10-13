/** Translation boundary for questions to the doctor and recorded answers. */
export type DoctorQuestionsLocale = 'de' | 'en' | 'es';
export const DEFAULT_DOCTOR_QUESTIONS_LOCALE: DoctorQuestionsLocale = 'de';

const de = {
  'common.error': 'Fehler', 'common.notice': 'Hinweis', 'common.cancel': 'Abbrechen', 'common.save': 'Speichern', 'common.delete': 'Löschen',
  'screen.title': 'Fragen für die Ärztin oder den Arzt', 'screen.subtitle': 'Alles Wichtige für den nächsten Termin', 'screen.previewSubtitle': 'Vorschau-Modus: nur ansehen',
  'preview.title': 'Nur Vorschau aktiv', 'preview.alertTitle': 'Nur Vorschau', 'preview.description': 'Du schaust den Schwangerschaftsmodus an. Arztfragen sind hier gesperrt.',
  'hero.title': 'Alles parat für den nächsten Besuch', 'hero.description': 'Sammle Fragen, halte Antworten fest und geh entspannt in deinen Termin.',
  'stats.open': 'Offene Fragen', 'stats.answered': 'Beantwortet', 'new.title': 'Neue Frage notieren',
  'new.description': 'Formuliere kurz und klar, damit du beim Termin nichts vergisst.',
  'new.placeholder': 'Was möchtest du beim nächsten Besuch ansprechen?', 'new.save': 'Frage sichern', 'new.saving': 'Speichere …',
  'state.loading': 'Fragen werden geladen …', 'state.emptyTitle': 'Noch keine Fragen gespeichert',
  'state.emptyDescription': 'Notiere spontan auftauchende Gedanken direkt hier, damit nichts verloren geht.',
  'section.openDescription': 'Kläre diese Punkte beim nächsten Termin.', 'section.answeredTitle': 'Bereits beantwortet',
  'section.answeredDescription': 'Ergänze Notizen oder markiere erneut als offen.',
  'question.open': 'Offen', 'question.answered': 'Beantwortet', 'question.updating': 'Wird aktualisiert …',
  'question.markOpen': 'Als offen markieren', 'question.markAnswered': 'Als beantwortet markieren',
  'answer.title': 'Antwort der Ärztin oder des Arztes', 'answer.placeholder': 'Notiere hier die Antwort oder eigene Gedanken …',
  'answer.empty': 'Tippe, um eine Antwort zu hinterlegen oder Notizen zu ergänzen.',
  'delete.title': 'Frage löschen', 'delete.confirm': 'Möchtest du diese Frage wirklich löschen?', 'delete.action': 'Frage löschen', 'delete.pending': 'Lösche …',
  'error.load': 'Fragen konnten nicht geladen werden.', 'error.questionRequired': 'Bitte gib eine Frage ein.',
  'error.service': 'Service nicht verfügbar.', 'error.saveQuestion': 'Frage konnte nicht gespeichert werden.',
  'error.status': 'Status konnte nicht aktualisiert werden.', 'error.delete': 'Frage konnte nicht gelöscht werden.',
  'error.answer': 'Antwort konnte nicht gespeichert werden.', 'feedback.questionSaved': 'Frage gespeichert.',
  'feedback.markedAnswered': 'Frage als beantwortet markiert.', 'feedback.markedOpen': 'Frage als offen markiert.',
  'feedback.deleted': 'Frage gelöscht.', 'feedback.answerSaved': 'Antwort gespeichert.',
} as const;
export type DoctorQuestionsTranslationKey = keyof typeof de;
type Catalog = Record<DoctorQuestionsTranslationKey, string>;

const en: Catalog = {
  'common.error': 'Error', 'common.notice': 'Note', 'common.cancel': 'Cancel', 'common.save': 'Save', 'common.delete': 'Delete',
  'screen.title': 'Questions for your doctor', 'screen.subtitle': 'Everything important for your next appointment', 'screen.previewSubtitle': 'Preview mode: view only',
  'preview.title': 'Preview only', 'preview.alertTitle': 'Preview only', 'preview.description': 'You are previewing pregnancy mode. Doctor questions are locked here.',
  'hero.title': 'Ready for your next visit', 'hero.description': 'Collect questions, record answers, and go into your appointment feeling prepared.',
  'stats.open': 'Open questions', 'stats.answered': 'Answered', 'new.title': 'Write down a new question',
  'new.description': 'Keep it short and clear so you do not forget anything at your appointment.',
  'new.placeholder': 'What would you like to discuss at your next visit?', 'new.save': 'Save question', 'new.saving': 'Saving …',
  'state.loading': 'Loading questions …', 'state.emptyTitle': 'No questions saved yet',
  'state.emptyDescription': 'Write down thoughts as they come up so nothing gets lost.',
  'section.openDescription': 'Discuss these points at your next appointment.', 'section.answeredTitle': 'Already answered',
  'section.answeredDescription': 'Add notes or mark a question as open again.', 'question.open': 'Open', 'question.answered': 'Answered',
  'question.updating': 'Updating …', 'question.markOpen': 'Mark as open', 'question.markAnswered': 'Mark as answered',
  'answer.title': "Doctor's answer", 'answer.placeholder': 'Write down the answer or your own thoughts here …',
  'answer.empty': 'Tap to record an answer or add notes.', 'delete.title': 'Delete question',
  'delete.confirm': 'Do you really want to delete this question?', 'delete.action': 'Delete question', 'delete.pending': 'Deleting …',
  'error.load': 'Questions could not be loaded.', 'error.questionRequired': 'Please enter a question.', 'error.service': 'Service unavailable.',
  'error.saveQuestion': 'The question could not be saved.', 'error.status': 'The status could not be updated.',
  'error.delete': 'The question could not be deleted.', 'error.answer': 'The answer could not be saved.',
  'feedback.questionSaved': 'Question saved.', 'feedback.markedAnswered': 'Question marked as answered.',
  'feedback.markedOpen': 'Question marked as open.', 'feedback.deleted': 'Question deleted.', 'feedback.answerSaved': 'Answer saved.',
};

const es: Catalog = {
  'common.error': 'Error', 'common.notice': 'Aviso', 'common.cancel': 'Cancelar', 'common.save': 'Guardar', 'common.delete': 'Eliminar',
  'screen.title': 'Preguntas para tu médica o médico', 'screen.subtitle': 'Todo lo importante para la próxima cita', 'screen.previewSubtitle': 'Modo de vista previa: solo lectura',
  'preview.title': 'Solo vista previa', 'preview.alertTitle': 'Solo vista previa', 'preview.description': 'Estás viendo el modo embarazo. Las preguntas médicas están bloqueadas aquí.',
  'hero.title': 'Todo listo para la próxima visita', 'hero.description': 'Reúne preguntas, anota las respuestas y acude a tu cita con tranquilidad.',
  'stats.open': 'Preguntas abiertas', 'stats.answered': 'Respondidas', 'new.title': 'Anotar una nueva pregunta',
  'new.description': 'Escríbela de forma breve y clara para no olvidar nada durante la cita.',
  'new.placeholder': '¿Qué quieres comentar en la próxima visita?', 'new.save': 'Guardar pregunta', 'new.saving': 'Guardando …',
  'state.loading': 'Cargando preguntas …', 'state.emptyTitle': 'Todavía no hay preguntas guardadas',
  'state.emptyDescription': 'Anota aquí cualquier duda cuando surja para que no se pierda.',
  'section.openDescription': 'Aclara estos puntos en la próxima cita.', 'section.answeredTitle': 'Ya respondidas',
  'section.answeredDescription': 'Añade notas o vuelve a marcar una pregunta como abierta.', 'question.open': 'Abierta', 'question.answered': 'Respondida',
  'question.updating': 'Actualizando …', 'question.markOpen': 'Marcar como abierta', 'question.markAnswered': 'Marcar como respondida',
  'answer.title': 'Respuesta de la médica o del médico', 'answer.placeholder': 'Anota aquí la respuesta o tus propios pensamientos …',
  'answer.empty': 'Toca para guardar una respuesta o añadir notas.', 'delete.title': 'Eliminar pregunta',
  'delete.confirm': '¿Seguro que quieres eliminar esta pregunta?', 'delete.action': 'Eliminar pregunta', 'delete.pending': 'Eliminando …',
  'error.load': 'No se pudieron cargar las preguntas.', 'error.questionRequired': 'Introduce una pregunta.', 'error.service': 'Servicio no disponible.',
  'error.saveQuestion': 'No se pudo guardar la pregunta.', 'error.status': 'No se pudo actualizar el estado.',
  'error.delete': 'No se pudo eliminar la pregunta.', 'error.answer': 'No se pudo guardar la respuesta.',
  'feedback.questionSaved': 'Pregunta guardada.', 'feedback.markedAnswered': 'Pregunta marcada como respondida.',
  'feedback.markedOpen': 'Pregunta marcada como abierta.', 'feedback.deleted': 'Pregunta eliminada.', 'feedback.answerSaved': 'Respuesta guardada.',
};

export const DOCTOR_QUESTIONS_TRANSLATIONS: Record<DoctorQuestionsLocale, Catalog> = { de, en, es };
export const translateDoctorQuestionsText = (locale: DoctorQuestionsLocale, key: DoctorQuestionsTranslationKey) =>
  DOCTOR_QUESTIONS_TRANSLATIONS[locale]?.[key] ?? de[key] ?? key;
