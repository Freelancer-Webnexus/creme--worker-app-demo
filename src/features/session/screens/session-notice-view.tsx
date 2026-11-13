import type { SessionNotice } from '@/features/session/session-notice';
import Card from '@/uikit/components/card';
import AppText from '@/uikit/components/text';

type SessionNoticeViewProps = {
	notice: SessionNotice;
};

/** Amber, the colour of "saved on this phone": the work is safe, not yet sent. */
const SessionNoticeView = ({ notice }: SessionNoticeViewProps) => (
	<Card accessibilityRole="alert" testID="session-notice" tone="pending_sync">
		<AppText variant="headline">{notice.title}</AppText>
		<AppText>{notice.body}</AppText>
	</Card>
);

export default SessionNoticeView;
