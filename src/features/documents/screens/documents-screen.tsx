import useDocumentsScreen from '@/features/documents/hooks/use-documents-screen';
import DocumentsScreenView from '@/features/documents/screens/documents-screen-view';

const DocumentsScreen = () => {
	const model = useDocumentsScreen();
	return <DocumentsScreenView {...model} />;
};

export default DocumentsScreen;
