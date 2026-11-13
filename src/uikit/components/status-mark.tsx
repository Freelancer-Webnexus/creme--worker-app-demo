import { StyleSheet, View } from 'react-native';
import AppText from '@/uikit/components/text';
import useTheme from '@/uikit/hooks/use-theme';
import { type StatusRole, statusColorsFor } from '@/uikit/tokens/status-role';

type StatusMarkProps = {
	role: StatusRole;
	size?: number;
};

const RING = 3;
const BAR = 3;

/**
 * A drawn shape for each status, so a status is never colour alone. The word
 * next to it carries the meaning for a screen reader: the mark is hidden from
 * accessibility on purpose.
 *
 * Ring: only on this phone. Half ring: delivered, waiting for staff. Disc with
 * a tick: done or approved. Diamond with a bang: staff asked for a change.
 * Square with a cross: could not be sent. Dash: nothing to report.
 */
const StatusMark = ({ role, size = 28 }: StatusMarkProps) => {
	const { semanticColors } = useTheme();
	const { background, foreground } = statusColorsFor(semanticColors, role);
	const box = { height: size, width: size };

	return (
		<View
			accessibilityElementsHidden
			importantForAccessibility="no-hide-descendants"
			style={[styles.box, box]}
		>
			<Shape
				background={background}
				foreground={foreground}
				role={role}
				size={size}
			/>
		</View>
	);
};

type ShapeProps = {
	background: string;
	foreground: string;
	role: StatusRole;
	size: number;
};

const Shape = ({ background, foreground, role, size }: ShapeProps) => {
	const round = { borderRadius: size / 2, height: size, width: size };

	switch (role) {
		case 'pending_sync':
			return (
				<View style={[round, { borderColor: foreground, borderWidth: RING }]} />
			);
		case 'pending_review':
			return (
				<View
					style={[
						round,
						styles.halfRing,
						{ borderColor: foreground, borderWidth: RING },
					]}
				>
					<View style={[styles.half, { backgroundColor: foreground }]} />
				</View>
			);
		case 'approved':
			return (
				<View style={[round, styles.center, { backgroundColor: foreground }]}>
					<View
						style={[
							styles.tick,
							{
								borderColor: background,
								height: size * 0.5,
								width: size * 0.28,
							},
						]}
					/>
				</View>
			);
		case 'correction':
			return (
				<View style={[styles.center, { height: size, width: size }]}>
					<View
						style={[
							styles.diamond,
							{
								backgroundColor: foreground,
								height: size * 0.72,
								width: size * 0.72,
							},
						]}
					/>
					<AppText
						allowFontScaling={false}
						style={[
							styles.bang,
							{ color: background, fontSize: size * 0.6, lineHeight: size },
						]}
					>
						!
					</AppText>
				</View>
			);
		case 'failed':
			return (
				<View
					style={[
						styles.center,
						styles.square,
						{ backgroundColor: foreground, height: size, width: size },
					]}
				>
					<View
						style={[
							styles.crossBar,
							styles.crossFirst,
							{ backgroundColor: background, width: size * 0.62 },
						]}
					/>
					<View
						style={[
							styles.crossBar,
							styles.crossSecond,
							{ backgroundColor: background, width: size * 0.62 },
						]}
					/>
				</View>
			);
		case 'neutral':
			return (
				<View
					style={[
						round,
						styles.center,
						{ borderColor: foreground, borderWidth: RING },
					]}
				>
					<View
						style={[
							styles.dash,
							{ backgroundColor: foreground, width: size * 0.4 },
						]}
					/>
				</View>
			);
		default:
			return role satisfies never;
	}
};

const styles = StyleSheet.create({
	bang: {
		fontWeight: '800',
		position: 'absolute',
		textAlign: 'center',
		width: '100%',
	},
	box: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	center: {
		alignItems: 'center',
		justifyContent: 'center',
	},
	crossBar: {
		borderRadius: 2,
		height: BAR,
		position: 'absolute',
	},
	crossFirst: {
		transform: [{ rotate: '45deg' }],
	},
	crossSecond: {
		transform: [{ rotate: '-45deg' }],
	},
	dash: {
		borderRadius: 2,
		height: BAR,
	},
	diamond: {
		borderRadius: 3,
		position: 'absolute',
		transform: [{ rotate: '45deg' }],
	},
	half: {
		height: '100%',
		width: '50%',
	},
	halfRing: {
		flexDirection: 'row',
		overflow: 'hidden',
	},
	square: {
		borderRadius: 6,
	},
	tick: {
		borderBottomWidth: BAR,
		borderRightWidth: BAR,
		marginTop: -2,
		transform: [{ rotate: '45deg' }],
	},
});

export default StatusMark;
export type { StatusMarkProps };
