import useCaptureScreen from '@/features/documents/hooks/use-capture-screen';
import CaptureScreenView from '@/features/documents/screens/capture-screen-view';

const CaptureScreen = () => {
	const model = useCaptureScreen();
	return <CaptureScreenView {...model} />;
};

export default CaptureScreen;
