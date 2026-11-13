import { Redirect } from 'expo-router';

/**
 * A link that matches no route (a stale deep link, a typo) lands on Home, which
 * itself sends a signed-out phone to sign in. A worker never sees a dead end.
 */
const NotFoundRoute = () => {
	return <Redirect href="/" />;
};

export default NotFoundRoute;
