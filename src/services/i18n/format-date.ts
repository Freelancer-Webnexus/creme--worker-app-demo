import type { Language } from '@/services/i18n/translate';

const ISO_DATE = /^(\d{4})-(\d{2})-(\d{2})(?:T[\d:.]+(?:Z|[+-]\d{2}:\d{2})?)?$/;

const localeFor = (language: Language): string =>
	language === 'es' ? 'es-MX' : 'en-US';

/** Building a formatter costs milliseconds on Hermes; one per language is enough. */
const formatters = new Map<Language, Intl.DateTimeFormat>();

const formatterFor = (language: Language): Intl.DateTimeFormat => {
	const cached = formatters.get(language);
	if (cached !== undefined) {
		return cached;
	}
	const formatter = new Intl.DateTimeFormat(localeFor(language), {
		day: 'numeric',
		month: 'long',
		timeZone: 'UTC',
		year: 'numeric',
	});
	formatters.set(language, formatter);
	return formatter;
};

/**
 * A server date written for the worker's language, for example "1 de marzo de
 * 2026". The server sends ISO dates (YYYY-MM-DD) or ISO timestamps. Only the
 * calendar day is kept, read and formatted as UTC, so the phone's time zone
 * never moves it a day. If Intl is missing or the text is not an ISO date, the
 * original text is shown: a plain date beats a wrong one.
 */
export const formatDate = (iso: string, language: Language): string => {
	const match = ISO_DATE.exec(iso);
	if (match === null) {
		return iso;
	}
	const day = `${match[1]}-${match[2]}-${match[3]}`;
	const date = new Date(`${day}T00:00:00Z`);
	if (Number.isNaN(date.getTime())) {
		return iso;
	}

	try {
		return formatterFor(language).format(date);
	} catch {
		return iso;
	}
};
