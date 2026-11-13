import { StyleSheet, View } from 'react-native';
import BrandMark from '@/uikit/components/brand-mark';

/**
 * Shown for the moment between a verified code and the first frame of Home.
 * The sign-in screens are gone by then, and the mark, like the launch splash,
 * reads as the app opening rather than a blank screen. The stack paints the
 * background.
 */
const SigningInView = () => (
	<View style={styles.root} testID="signing-in">
		<BrandMark />
	</View>
);

const styles = StyleSheet.create({
	root: {
		alignItems: 'center',
		flex: 1,
		justifyContent: 'center',
	},
});

export default SigningInView;
