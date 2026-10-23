import { CaseDetail } from '@/components/console/CaseDetail';
export default async function Page({ params }: { params: Promise<{ caseId: string }> }) {
  const { caseId } = await params;
  return <CaseDetail key={caseId} caseId={caseId}/>;
}
