import { Redirect } from 'expo-router';
import useCodeScreen from '@/features/session/hooks/use-code-screen';
import CodeScreenView from '@/features/session/screens/code-screen-view';

const CodeScreen = () => {
	const model = useCodeScreen();

	if (model.needsPhone) {
		return <Redirect href="/(auth)/phone" />;
	}
	return <CodeScreenView {...model} />;
};

export default CodeScreen;
