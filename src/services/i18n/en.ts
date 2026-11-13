import type { es } from '@/services/i18n/es';

export const en: Record<keyof typeof es, string> = {
	'signin.phone_label': 'Your cell phone number',
	'signin.phone_hint': 'With the country code, for example +52 55 1000 0001',
	'signin.continue': 'Continue',
	'signin.code_label': 'Code we sent you',
	'signin.code_hint': 'Type the 6 numbers',
	'signin.verify': 'Sign in',
	'signin.wrong_code': 'That code is not right. Check it and try again.',
	'signin.no_connection':
		'You need internet to sign in. After you sign in, you can work without a connection.',
	'signin.server_error': 'The server is not responding. Try again in a moment.',
	'picker.title': 'Who are you?',
	'picker.subtitle':
		'More than one person uses this phone. Choose your name to continue.',

	'home.greeting': 'Hi, {name}',
	'home.employer': 'Employer',
	'home.worksite': 'Worksite',
	'home.season': 'Season',
	'home.season_range': 'From {start} to {end}',
	'home.terms_needs_confirmation': 'The terms still need your confirmation',
	'home.terms_pending_sync': 'Confirmed on this phone, not sent yet',
	'home.terms_confirmed': 'Terms confirmed',
	'home.timeline_title': 'Your progress',
	'timeline.terms_confirmed': 'Terms confirmed',
	'timeline.documents_submitted': 'Documents sent',
	'timeline.documents_approved': 'Documents approved',

	'sync.offline': 'No connection',
	'sync.sending': 'Sending…',
	'sync.nothing_pending': 'Nothing waiting to be sent from this phone.',
	'sync.retrying': 'Trying again in {seconds} s',
	'sync.session_expired': 'Sign in again to continue.',
	'sync.retry_now': 'Try again now',

	'terms.title': 'Terms',
	'terms.version': 'Version {version}',
	'terms.published': 'Published on {date}',
	'terms.confirm': 'Confirm',
	'terms.confirmed': 'You confirmed these terms',
	'terms.changed': 'The terms changed. Read the new version and confirm again.',
	'terms.needs_confirmation':
		'Read the terms and confirm that you accept them.',
	'terms.rejected': 'Your confirmation could not be sent. Try again.',
	'terms.saving': 'Saving…',
	'terms.save_failed': 'Could not save on this phone. Try again.',

	'documents.title': 'Documents',
	'documents.type.passport': 'Passport',
	'documents.type.ds160_confirmation': 'DS-160 confirmation',
	'documents.type.signed_contract': 'Signed contract',
	'documents.type.unknown': 'Document',
	'documents.state.not_submitted': 'Not sent',
	'documents.state.pending_review': 'Sent, waiting for staff review',
	'documents.state.approved': 'Approved',
	'documents.state.correction_requested': 'Needs a correction',
	'documents.state.correction_reason': 'Reason: {reason}',
	'documents.state.failed_too_large':
		'Could not send: the photo is too big. Take another one.',
	'documents.state.failed_unknown_type':
		'Could not send: this document is no longer requested.',
	'documents.state.failed_generic': 'Could not send. Try again.',
	'documents.action.take_photo': 'Take photo',
	'documents.action.choose_gallery': 'Choose from gallery',
	'documents.action.retake': 'Take another photo',
	'documents.action.submit': 'Use this photo',
	'documents.action.cancel': 'Cancel',
	'documents.action.dismiss': 'Dismiss',
	'documents.none_required': 'No documents are requested right now.',

	'capture.preview_title': 'Check your photo',
	'capture.compressing': 'Getting the photo ready…',
	'capture.choose_hint':
		'Take a clear photo in good light, without shadows. It works without internet.',
	'capture.permission_denied_title': 'We cannot use the camera',
	'capture.permission_denied_body':
		'You did not allow the camera. Open the phone settings, go to Permissions and turn on the camera.',
	'capture.open_settings': 'Open settings',
	'capture.try_again': 'Try again',
	'capture.problem_title': 'The photo was not saved',
	'capture.too_large':
		'The photo is too big, even after making it smaller. Take another one.',
	'capture.save_failed': 'We could not save it on this phone. Try again.',
	'capture.unavailable_title': 'This document cannot be sent',
	'capture.unavailable_body':
		'Go back to Documents and pick one from the list.',
	'capture.not_needed_title': 'This document does not need another photo',
	'capture.not_needed_body':
		'It is already saved or sent. Check its status in Documents.',
	'capture.compression_failed':
		'We could not get the photo ready. Please take another one.',
	'capture.picker_failed':
		'The camera or the gallery did not open. Tap Try again and choose again.',

	'reauth.title': 'Sign in again',
	'reauth.body':
		'Your session expired. What you already did is still saved on this phone and is not lost. Sign in again to send it.',
	'reauth.button': 'Sign in again',

	'language.label': 'Language',
	'language.es': 'Español',
	'language.en': 'English',
	'worker.switch': 'Switch person',
	'session.sign_out': 'Sign out',
	'session.sign_out_confirm_title': 'Do you want to sign out?',
	'session.sign_out_confirm_body':
		'What is still waiting to be sent stays saved on this phone. It will be sent when you sign in again.',
	'session.sign_out_confirm_body_clear':
		'Everything has been sent. Signing back in needs internet.',
	'session.sign_out_confirm_yes': 'Yes, sign out',
	'session.sign_out_confirm_no': 'No, stay',

	'error.generic': 'Something went wrong. Try again.',
	'error.retry': 'Try again',

	'debug.title': 'Debug',
	'debug.disable_compression': 'Disable compression',
	'debug.api_url': 'API URL',
	'debug.back': 'Back',
	'debug.compression_hint':
		'With compression off, the server rejects a photo over 1.5 MB (413).',

	'a11y.sync_indicator': 'Sending status: {status}',
	'a11y.document_row': '{document}: {status}',

	'tabs.home': 'Home',
	'tabs.documents': 'Documents',
	'tabs.terms': 'Terms',

	'signin.title': 'Sign in with your phone',
	'signin.invalid_phone':
		'Check the number. Type it with the country code, for example +52 55 1000 0001.',
	'signin.code_title': 'Type the code',
	'signin.sending_code': 'Sending the code…',
	'signin.verifying': 'Checking the code…',
	'signin.code_sent_to': 'We sent a text message with a code to {phone}.',
	'signin.change_number': 'Use a different number',

	'pending.base': 'Saved on this phone. Not sent yet.',
	'pending.reason_offline': 'Waiting for connection.',
	'pending.reason_sending': 'Sending now.',
	'pending.reason_retry': 'Will try again soon.',
	'pending.reason_sign_in': 'Sign in again to send.',
	'sync.retrying_soon': 'Trying again in a few seconds',
	'sync.checking': 'Checking…',
	'sync.checking_detail': 'We are checking what is saved on this phone.',
	'sync.offline_waiting_one':
		'1 action saved on this phone, waiting for connection.',
	'sync.offline_waiting_other':
		'{count} actions saved on this phone, waiting for connection.',
	'sync.offline_clear':
		'Nothing waiting to be sent. Anything you do will be saved on this phone.',
	'sync.sending_detail_one':
		'1 action. It stays saved on this phone until it arrives.',
	'sync.sending_detail_other':
		'{count} actions. They stay saved on this phone until they arrive.',
	'sync.saved_one': '1 action saved on this phone, not sent yet.',
	'sync.saved_other': '{count} actions saved on this phone, not sent yet.',
	'sync.session_expired_title': 'Your session expired',
	'sync.session_expired_saved_one':
		'1 action is saved on this phone and is not lost. Sign in again to send it.',
	'sync.session_expired_saved_other':
		'{count} actions are saved on this phone and are not lost. Sign in again to send them.',
	'sync.attention_one': '1 action needs your attention',
	'sync.attention_other': '{count} actions need your attention',
	'sync.attention_detail':
		'It could not be sent. Open Documents or Terms to see what to do.',

	'state.empty_title': 'No data on this phone yet',
	'state.empty_body':
		'The first time you need internet to load your information. Connect, then try again.',
	'state.server_title': 'The server is not responding',
	'state.server_body':
		'We could not load your information yet. Your phone is connected. Try again in a moment.',
	'state.loading': 'Loading your information…',
	'home.terms_rejected': 'Your confirmation of the terms could not be sent',
	'home.order_title': 'Your job',
	'home.account_title': 'Your account',
	'home.language_title': 'App language',
	'timeline.done': 'Done',
	'timeline.todo': 'Still to do',
	'timeline.saved_on_phone': 'Saved on this phone, not sent yet',
	'timeline.in_review': 'Sent, waiting for review',
	'a11y.timeline_step': '{step}: {status}',
	'worker.current': 'Signed in as {name}',
};
