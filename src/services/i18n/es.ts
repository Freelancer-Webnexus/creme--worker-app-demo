export const es = {
	'signin.phone_label': 'Tu número de celular',
	'signin.phone_hint': 'Con el código de país, por ejemplo +52 55 1000 0001',
	'signin.continue': 'Continuar',
	'signin.code_label': 'Código que te enviamos',
	'signin.code_hint': 'Escribe los 6 números',
	'signin.verify': 'Entrar',
	'signin.wrong_code':
		'El código no es correcto. Revísalo e inténtalo otra vez.',
	'signin.no_connection':
		'Para entrar necesitas internet. Después de entrar, puedes trabajar sin conexión.',
	'signin.server_error':
		'El servidor no responde. Intenta de nuevo en un momento.',
	'picker.title': '¿Quién eres?',
	'picker.subtitle':
		'Este teléfono tiene más de una persona. Elige tu nombre para seguir.',

	'home.greeting': 'Hola, {name}',
	'home.employer': 'Empleador',
	'home.worksite': 'Lugar de trabajo',
	'home.season': 'Temporada',
	'home.season_range': 'Del {start} al {end}',
	'home.terms_needs_confirmation': 'Falta confirmar los términos',
	'home.terms_pending_sync': 'Confirmados en este teléfono, falta enviarlos',
	'home.terms_confirmed': 'Términos confirmados',
	'home.timeline_title': 'Tu avance',
	'timeline.terms_confirmed': 'Términos confirmados',
	'timeline.documents_submitted': 'Documentos enviados',
	'timeline.documents_approved': 'Documentos aprobados',

	'sync.offline': 'Sin conexión',
	'sync.sending': 'Enviando…',
	'sync.nothing_pending': 'Nada por enviar en este teléfono.',
	'sync.retrying': 'Reintentando en {seconds} s',
	'sync.session_expired': 'Entra de nuevo para seguir.',
	'sync.retry_now': 'Reintentar ahora',

	'terms.title': 'Términos',
	'terms.version': 'Versión {version}',
	'terms.published': 'Publicada el {date}',
	'terms.confirm': 'Confirmar',
	'terms.confirmed': 'Confirmaste estos términos',
	'terms.changed':
		'Los términos cambiaron. Lee la versión nueva y confirma otra vez.',
	'terms.needs_confirmation': 'Lee los términos y confirma que los aceptas.',
	'terms.rejected': 'No se pudo enviar tu confirmación. Inténtalo otra vez.',
	'terms.saving': 'Guardando…',
	'terms.save_failed':
		'No se pudo guardar en este teléfono. Inténtalo otra vez.',

	'documents.title': 'Documentos',
	'documents.type.passport': 'Pasaporte',
	'documents.type.ds160_confirmation': 'Confirmación DS-160',
	'documents.type.signed_contract': 'Contrato firmado',
	'documents.type.unknown': 'Documento',
	'documents.state.not_submitted': 'Sin enviar',
	'documents.state.pending_review': 'Enviado, esperando revisión del personal',
	'documents.state.approved': 'Aprobado',
	'documents.state.correction_requested': 'Hay que corregirlo',
	'documents.state.correction_reason': 'Motivo: {reason}',
	'documents.state.failed_too_large':
		'No se pudo enviar: la foto pesa demasiado. Toma otra.',
	'documents.state.failed_unknown_type':
		'No se pudo enviar: ya no se pide este documento.',
	'documents.state.failed_generic': 'No se pudo enviar. Inténtalo otra vez.',
	'documents.action.take_photo': 'Tomar foto',
	'documents.action.choose_gallery': 'Elegir de la galería',
	'documents.action.retake': 'Tomar otra foto',
	'documents.action.submit': 'Usar esta foto',
	'documents.action.cancel': 'Cancelar',
	'documents.action.dismiss': 'Descartar',
	'documents.none_required': 'Por ahora no te piden documentos.',

	'capture.preview_title': 'Revisa tu foto',
	'capture.compressing': 'Preparando la foto…',
	'capture.choose_hint':
		'Toma una foto clara, con buena luz y sin sombras. Funciona sin internet.',
	'capture.permission_denied_title': 'No podemos usar la cámara',
	'capture.permission_denied_body':
		'No diste permiso para usar la cámara. Abre los ajustes del teléfono, entra a Permisos y activa la cámara.',
	'capture.open_settings': 'Abrir ajustes',
	'capture.try_again': 'Intentar otra vez',
	'capture.problem_title': 'La foto no quedó guardada',
	'capture.too_large':
		'La foto pesa demasiado, incluso después de reducirla. Toma otra.',
	'capture.save_failed':
		'No pudimos guardarla en este teléfono. Inténtalo otra vez.',
	'capture.unavailable_title': 'Este documento no se puede enviar',
	'capture.unavailable_body': 'Vuelve a Documentos y elige uno de la lista.',
	'capture.not_needed_title': 'Este documento no necesita otra foto',
	'capture.not_needed_body':
		'Ya está guardado o enviado. Revisa su estado en Documentos.',
	'capture.compression_failed':
		'No pudimos preparar la foto. Toma otra, por favor.',
	'capture.picker_failed':
		'No se pudo abrir la cámara o la galería. Toca Intentar otra vez y elige de nuevo.',

	'reauth.title': 'Entra de nuevo',
	'reauth.body':
		'Tu sesión venció. Lo que ya hiciste sigue guardado en este teléfono y no se pierde. Entra de nuevo para enviarlo.',
	'reauth.button': 'Entrar de nuevo',

	'language.label': 'Idioma',
	'language.es': 'Español',
	'language.en': 'English',
	'worker.switch': 'Cambiar de persona',
	'session.sign_out': 'Salir',
	'session.sign_out_confirm_title': '¿Quieres salir?',
	'session.sign_out_confirm_body':
		'Lo que falta enviar sigue guardado en este teléfono. Se enviará cuando vuelvas a entrar.',
	'session.sign_out_confirm_body_clear':
		'Todo ya se envió. Para volver a entrar necesitas internet.',
	'session.sign_out_confirm_yes': 'Sí, salir',
	'session.sign_out_confirm_no': 'No, quedarme',

	'error.generic': 'Algo salió mal. Inténtalo otra vez.',
	'error.retry': 'Reintentar',

	'debug.title': 'Depuración',
	'debug.disable_compression': 'Desactivar compresión',
	'debug.api_url': 'URL de la API',
	'debug.back': 'Volver',
	'debug.compression_hint':
		'Con la compresión apagada, una foto de más de 1,5 MB la rechaza el servidor (413).',

	'a11y.sync_indicator': 'Estado del envío: {status}',
	'a11y.document_row': '{document}: {status}',

	'tabs.home': 'Inicio',
	'tabs.documents': 'Documentos',
	'tabs.terms': 'Términos',

	'signin.title': 'Entra con tu celular',
	'signin.invalid_phone':
		'Revisa el número. Escríbelo con el código de país, por ejemplo +52 55 1000 0001.',
	'signin.code_title': 'Escribe el código',
	'signin.sending_code': 'Enviando el código…',
	'signin.verifying': 'Revisando el código…',
	'signin.code_sent_to': 'Enviamos un código por mensaje al {phone}.',
	'signin.change_number': 'Cambiar de número',

	'pending.base': 'Guardado en este teléfono. Todavía no se envió.',
	'pending.reason_offline': 'Esperando conexión.',
	'pending.reason_sending': 'Enviando ahora.',
	'pending.reason_retry': 'Se reintentará pronto.',
	'pending.reason_sign_in': 'Entra de nuevo para enviar.',
	'sync.retrying_soon': 'Reintentando en unos segundos',
	'sync.checking': 'Revisando…',
	'sync.checking_detail':
		'Estamos revisando lo que hay guardado en este teléfono.',
	'sync.offline_waiting_one':
		'1 acción guardada en este teléfono, esperando conexión.',
	'sync.offline_waiting_other':
		'{count} acciones guardadas en este teléfono, esperando conexión.',
	'sync.offline_clear':
		'Nada por enviar. Lo que hagas se guardará en este teléfono.',
	'sync.sending_detail_one':
		'1 acción. Sigue guardada en este teléfono hasta que llegue.',
	'sync.sending_detail_other':
		'{count} acciones. Siguen guardadas en este teléfono hasta que lleguen.',
	'sync.saved_one': '1 acción guardada en este teléfono, aún sin enviar.',
	'sync.saved_other':
		'{count} acciones guardadas en este teléfono, aún sin enviar.',
	'sync.session_expired_title': 'Tu sesión venció',
	'sync.session_expired_saved_one':
		'1 acción está guardada en este teléfono y no se pierde. Entra de nuevo para enviarla.',
	'sync.session_expired_saved_other':
		'{count} acciones están guardadas en este teléfono y no se pierden. Entra de nuevo para enviarlas.',
	'sync.attention_one': '1 acción necesita tu atención',
	'sync.attention_other': '{count} acciones necesitan tu atención',
	'sync.attention_detail':
		'No se pudo enviar. Abre Documentos o Términos para ver qué hacer.',

	'state.empty_title': 'Todavía no hay datos en este teléfono',
	'state.empty_body':
		'La primera vez necesitas internet para cargar tu información. Conéctate e inténtalo otra vez.',
	'state.server_title': 'El servidor no responde',
	'state.server_body':
		'Todavía no pudimos cargar tu información. Tu teléfono sí tiene conexión. Inténtalo otra vez en un momento.',
	'state.loading': 'Cargando tu información…',
	'home.terms_rejected': 'No se pudo enviar tu confirmación de los términos',
	'home.order_title': 'Tu trabajo',
	'home.account_title': 'Tu cuenta',
	'home.language_title': 'Idioma de la app',
	'timeline.done': 'Hecho',
	'timeline.todo': 'Falta',
	'timeline.saved_on_phone': 'Guardado en este teléfono, falta enviar',
	'timeline.in_review': 'Enviados, falta que los revisen',
	'a11y.timeline_step': '{step}: {status}',
	'worker.current': 'Entraste como {name}',
} as const;
