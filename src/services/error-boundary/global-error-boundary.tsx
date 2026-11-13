import { Component, type ErrorInfo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { getLanguage } from '@/services/i18n/language-store';
import { translate } from '@/services/i18n/translate';
import { logger } from '@/services/logger/logger';
import Button from '@/uikit/components/button';
import Screen from '@/uikit/components/screen';
import AppText from '@/uikit/components/text';
import { spacing } from '@/uikit/tokens/spacing';

type GlobalErrorBoundaryProps = {
	children: ReactNode;
	onError: () => void;
};

type GlobalErrorBoundaryState = {
	error: Error | null;
};

class GlobalErrorBoundary extends Component<
	GlobalErrorBoundaryProps,
	GlobalErrorBoundaryState
> {
	state: GlobalErrorBoundaryState = {
		error: null,
	};

	static getDerivedStateFromError(error: Error): GlobalErrorBoundaryState {
		return {
			error,
		};
	}

	componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
		logger.error('global-error-boundary', error.message, {
			componentStack: errorInfo.componentStack,
		});
		this.props.onError();
	}

	private readonly onTryAgainPress = (): void => {
		this.setState({
			error: null,
		});
	};

	render() {
		if (!this.state.error) {
			return this.props.children;
		}

		const language = getLanguage();

		return (
			<Screen>
				<View style={styles.stack}>
					<AppText variant="title">
						{translate(language, 'error.generic')}
					</AppText>
					{__DEV__ ? <AppText>{this.state.error.message}</AppText> : null}
					<Button
						onPress={this.onTryAgainPress}
						title={translate(language, 'error.retry')}
					/>
				</View>
			</Screen>
		);
	}
}

const styles = StyleSheet.create({
	stack: {
		gap: spacing.md,
	},
});

export default GlobalErrorBoundary;
