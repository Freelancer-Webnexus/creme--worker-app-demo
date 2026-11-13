import { StyleSheet } from 'react-native';
import Image from '@/uikit/components/image';
import useTheme from '@/uikit/hooks/use-theme';

const sources = {
	dark: require('../../../assets/brand-mark-dark.png'),
	light: require('../../../assets/brand-mark.png'),
};

const SIZE = 64;

/** The app mark. Decorative: the screen title says where the worker is. */
const BrandMark = () => {
	const { scheme } = useTheme();

	return (
		<Image
			accessible={false}
			contentFit="contain"
			importantForAccessibility="no-hide-descendants"
			source={sources[scheme]}
			style={styles.mark}
			transition={0}
		/>
	);
};

const styles = StyleSheet.create({
	mark: {
		height: SIZE,
		width: SIZE,
	},
});

export default BrandMark;
