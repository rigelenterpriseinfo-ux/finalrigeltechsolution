import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const AuthTestButton = () => {
  const testAuth = async () => {
    try {
      console.log('Testing auth context...');
      
      // First, test the session
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      console.log('Current session:', { session: !!session, user: !!session?.user, error: sessionError });
      
      if (!session) {
        toast.error("No active session found");
        return;
      }

      // Test database query with auth context
      const { data: authTest, error: authError } = await supabase
        .rpc('get_current_user_role');
        
      console.log('Auth test result:', { authTest, authError });

      // Test suppliers query
      const { data: suppliers, error: suppliersError } = await supabase
        .from('suppliers')
        .select('*')
        .limit(5);
        
      console.log('Suppliers test:', { 
        count: suppliers?.length || 0, 
        suppliers: suppliers?.slice(0, 2),
        error: suppliersError 
      });

      if (suppliersError) {
        toast.error(`Suppliers error: ${suppliersError.message}`);
      } else {
        toast.success(`Found ${suppliers?.length || 0} suppliers`);
      }

      // Force refresh session if needed
      if (authError || suppliersError) {
        console.log('Refreshing session...');
        const { data: refreshData, error: refreshError } = await supabase.auth.refreshSession();
        console.log('Session refresh result:', { refreshData: !!refreshData, refreshError });
        
        if (refreshError) {
          toast.error(`Session refresh error: ${refreshError.message}`);
        } else {
          toast.success("Session refreshed - please try again");
        }
      }

    } catch (error) {
      console.error('Auth test error:', error);
      toast.error("Auth test failed");
    }
  };

  return (
    <Button onClick={testAuth} variant="outline" size="sm">
      Test Auth
    </Button>
  );
};