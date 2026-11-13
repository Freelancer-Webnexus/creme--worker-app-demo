import {
	ScrollView as NativeScrollView,
	type ScrollViewProps,
} from 'react-native';

type AppScrollViewProps = ScrollViewProps;

const AppScrollView = (props: AppScrollViewProps) => {
	const {
		alwaysBounceVertical = false,
		showsVerticalScrollIndicator = false,
		...restProps
	} = props;

	return (
		<NativeScrollView
			alwaysBounceVertical={alwaysBounceVertical}
			showsVerticalScrollIndicator={showsVerticalScrollIndicator}
			{...restProps}
		/>
	);
};

export default AppScrollView;
export type { AppScrollViewProps };
