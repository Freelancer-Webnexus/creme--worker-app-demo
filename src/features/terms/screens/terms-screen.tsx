import useTermsScreen from '@/features/terms/hooks/use-terms-screen';
import TermsScreenView from '@/features/terms/screens/terms-screen-view';

const TermsScreen = () => {
	const model = useTermsScreen();
	return <TermsScreenView {...model} />;
};

export default TermsScreen;
