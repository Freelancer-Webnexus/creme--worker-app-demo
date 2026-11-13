import useHomeScreen from '@/features/home/hooks/use-home-screen';
import HomeScreenView from '@/features/home/screens/home-screen-view';

const HomeScreen = () => {
	const model = useHomeScreen();
	return <HomeScreenView {...model} />;
};

export default HomeScreen;
