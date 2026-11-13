import usePhoneScreen from '@/features/session/hooks/use-phone-screen';
import PhoneScreenView from '@/features/session/screens/phone-screen-view';

const PhoneScreen = () => {
	const model = usePhoneScreen();
	return <PhoneScreenView {...model} />;
};

export default PhoneScreen;
