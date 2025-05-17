'use client'

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { getApiUrl } from '@/utils/apiConfig';

const ADMIN_AUTH_TOKEN_KEY = 'adminAuthToken';

// Interface matching ISubscriptionPlan from backend model
interface SubscriptionPlanData {
  _id: string;
  planId: string;
  name: string;
  dailyLikeQuota: number;
  description: string;
  features: string[];
  price?: {
    monthly?: number;
    yearly?: number;
  };
  isActive: boolean;
  order: number;
  isDefault: boolean; // Added to reflect backend model
  createdAt?: string; // Optional on create/edit, present on fetch
  updatedAt?: string; // Optional on create/edit, present on fetch
}

// For the form, all fields can be optional initially or during creation
type EditableSubscriptionPlanData = Partial<Omit<SubscriptionPlanData, '_id' | 'createdAt' | 'updatedAt'>>;

const initialEditValues: EditableSubscriptionPlanData = {
  planId: '',
  name: '',
  dailyLikeQuota: 0,
  description: '',
  features: [],
  price: { monthly: 0, yearly: 0 },
  isActive: true,
  order: 0,
  isDefault: false, // Added default for the new field
};

export default function SubscriptionsPage() {
  const router = useRouter();
  const [subscriptionPlans, setSubscriptionPlans] = useState<SubscriptionPlanData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const [isEditing, setIsEditing] = useState<boolean>(false); // True if creating or editing
  const [editingPlanId, setEditingPlanId] = useState<string | null>(null); // MongoDB _id of plan being edited, or null if creating
  const [editValues, setEditValues] = useState<EditableSubscriptionPlanData>(initialEditValues);

  const fetchPlans = async () => {
    setLoading(true);
    setError(null);
    const token = localStorage.getItem(ADMIN_AUTH_TOKEN_KEY);

    if (!token) {
      router.push('/login');
      return;
    }

    try {
      const response = await fetch(getApiUrl('admin/subscription-plans'), {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          localStorage.removeItem(ADMIN_AUTH_TOKEN_KEY);
          router.push('/login');
          return;
        }
        const errorData = await response.json().catch(() => ({ message: 'Failed to fetch subscription plans.' }));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      if (result.success && Array.isArray(result.data)) {
        setSubscriptionPlans(result.data);
      } else {
        throw new Error(result.message || 'Failed to process subscription plan data.');
      }
    } catch (err: unknown) {
      console.error('Error fetching subscription plans:', err);
      setError(err instanceof Error ? err.message : 'An unexpected error occurred while fetching plans.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [router]);


  const handleOpenCreateModal = () => {
    setIsEditing(true);
    setEditingPlanId(null);
    setEditValues(initialEditValues);
    // In a real app, you'd open a modal here
    console.log("Open create modal/form");
  };

  const handleEditPlan = (plan: SubscriptionPlanData) => {
    setIsEditing(true);
    setEditingPlanId(plan._id);
    setEditValues({
      planId: plan.planId,
      name: plan.name,
      dailyLikeQuota: plan.dailyLikeQuota,
      description: plan.description,
      features: [...plan.features],
      price: plan.price ? { ...plan.price } : { monthly: 0, yearly: 0 },
      isActive: plan.isActive,
      order: plan.order,
    });
    // In a real app, you'd open a modal here, pre-filled with plan data
    console.log("Open edit modal/form for plan:", plan._id);
  };

  const handleCancelEdit = () => {
    setIsEditing(false);
    setEditingPlanId(null);
    setEditValues(initialEditValues);
    // Close modal
  };

  const handleFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    
    if (name.startsWith("price.")) {
        const priceField = name.split(".")[1] as keyof NonNullable<EditableSubscriptionPlanData['price']>;
        setEditValues(prev => ({
            ...prev,
            price: {
                ...(prev.price || {}),
                [priceField]: type === 'number' ? parseFloat(value) || 0 : value
            }
        }));
    } else if (type === 'checkbox') {
        setEditValues(prev => ({ ...prev, [name]: (e.target as HTMLInputElement).checked }));
    } else if (type === 'number') {
        setEditValues(prev => ({ ...prev, [name]: parseInt(value) || 0 }));
    }
     else {
        setEditValues(prev => ({ ...prev, [name]: value }));
    }
  };
  
  // // Feature handlers - commented out as UI is placeholder
  // const handleFeatureChange = (index: number, value: string) => {
  //   const newFeatures = [...(editValues.features || [])];
  //   newFeatures[index] = value;
  //   setEditValues(prev => ({ ...prev, features: newFeatures }));
  // };

  // const handleAddFeature = () => {
  //   setEditValues(prev => ({ ...prev, features: [...(prev.features || []), ''] }));
  // };

  // const handleRemoveFeature = (index: number) => {
  //   const newFeatures = [...(editValues.features || [])];
  //   newFeatures.splice(index, 1);
  //   setEditValues(prev => ({ ...prev, features: newFeatures }));
  // };


  const handleSubmitForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setSuccessMessage(null);
    const token = localStorage.getItem(ADMIN_AUTH_TOKEN_KEY);

    if (!token) {
      router.push('/login');
      return;
    }

    const method = editingPlanId ? 'PUT' : 'POST';
    const url = editingPlanId
      ? getApiUrl(`admin/subscription-plans/${editingPlanId}`)
      : getApiUrl('admin/subscription-plans');

    // Ensure features is an array
    const payload: EditableSubscriptionPlanData = {
        planId: editValues.planId,
        name: editValues.name,
        dailyLikeQuota: editValues.dailyLikeQuota,
        description: editValues.description,
        features: editValues.features || [],
        price: editValues.price,
        isActive: editValues.isActive,
        order: editValues.order,
    };
    // _id is not part of EditableSubscriptionPlanData, so it won't be in payload unless explicitly added to editValues from plan._id

    try {
      const response = await fetch(url, {
        method: method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setSuccessMessage(`Subscription plan ${editingPlanId ? 'updated' : 'created'} successfully!`);
        setIsEditing(false);
        setEditingPlanId(null);
        fetchPlans(); // Refresh the list
      } else {
        throw new Error(result.message || `Failed to ${editingPlanId ? 'update' : 'create'} plan.`);
      }
    } catch (err: unknown) {
      console.error(`Error ${editingPlanId ? 'updating' : 'creating'} subscription plan:`, err);
      setError(err instanceof Error ? err.message : 'An unknown error occurred.');
    } finally {
      setSaving(false);
    }
  };
  
  const handleDeletePlan = async (planIdToDelete: string) => {
    if (!window.confirm("Are you sure you want to delete this subscription plan? This action cannot be undone.")) {
        return;
    }
    setLoading(true); // Or a specific deleting state
    setError(null);
    setSuccessMessage(null);
    const token = localStorage.getItem(ADMIN_AUTH_TOKEN_KEY);

    if (!token) {
        router.push('/login');
        return;
    }

    try {
        const response = await fetch(getApiUrl(`admin/subscription-plans/${planIdToDelete}`), {
            method: 'DELETE',
            headers: {
                'Authorization': `Bearer ${token}`,
            },
        });

        const result = await response.json();
        if (response.ok && result.success) {
            setSuccessMessage('Subscription plan deleted successfully!');
            fetchPlans(); // Refresh the list
        } else {
            throw new Error(result.message || 'Failed to delete plan.');
        }
    } catch (err: unknown) {
        console.error('Error deleting subscription plan:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred while deleting.');
    } finally {
        setLoading(false);
    }
  };

const handleSetDefaultPlan = async (planIdToSetAsDefault: string) => {
    if (!window.confirm("Are you sure you want to set this plan as the default? Any existing default plan will be unset.")) {
        return;
    }
    setSaving(true); // Use general saving state or a specific one
    setError(null);
    setSuccessMessage(null);
    const token = localStorage.getItem(ADMIN_AUTH_TOKEN_KEY);

    if (!token) {
        router.push('/login');
        setSaving(false);
        return;
    }

    try {
        const response = await fetch(getApiUrl(`admin/subscription-plans/${planIdToSetAsDefault}/set-default`), {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`,
            },
        });

        const result = await response.json();
        if (response.ok && result.success) {
            setSuccessMessage(result.message || 'Plan set as default successfully!');
            fetchPlans(); // Refresh the list to show the new default plan
        } else {
            throw new Error(result.message || 'Failed to set plan as default.');
        }
    } catch (err: unknown) {
        console.error('Error setting default plan:', err);
        setError(err instanceof Error ? err.message : 'An unknown error occurred while setting default plan.');
    } finally {
        setSaving(false);
    }
  };

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Subscription Plan Management</h1>
        <button
          onClick={handleOpenCreateModal}
          className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700"
        >
          + Create New Plan
        </button>
      </div>

      {/* Modal/Form for Create/Edit */}
      {isEditing && (
        <Card className="my-4">
          <CardHeader>
            <CardTitle>{editingPlanId ? 'Edit Subscription Plan' : 'Create New Subscription Plan'}</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmitForm} className="space-y-4">
              <div>
                <label htmlFor="planId" className="block text-sm font-medium">Plan ID (e.g., FREE, PREMIUM - uppercase, no spaces)</label>
                <input type="text" name="planId" id="planId" value={editValues.planId || ''} onChange={handleFormChange} required disabled={!!editingPlanId} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"/>
              </div>
              <div>
                <label htmlFor="name" className="block text-sm font-medium">Plan Name</label>
                <input type="text" name="name" id="name" value={editValues.name || ''} onChange={handleFormChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"/>
              </div>
              <div>
                <label htmlFor="description" className="block text-sm font-medium">Description</label>
                <textarea name="description" id="description" value={editValues.description || ''} onChange={handleFormChange} required rows={3} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"></textarea>
              </div>
              <div>
                <label htmlFor="dailyLikeQuota" className="block text-sm font-medium">Daily Like Quota</label>
                <input type="number" name="dailyLikeQuota" id="dailyLikeQuota" value={editValues.dailyLikeQuota || 0} onChange={handleFormChange} required className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"/>
              </div>
              
              <div>
                <label className="block text-sm font-medium">Features (one per line)</label>
                 <textarea
                    name="features"
                    id="features"
                    value={(editValues.features || []).join('\n')}
                    onChange={(e) => setEditValues(prev => ({...prev, features: e.target.value.split('\n').map(f => f.trim()).filter(f => f)}))}
                    rows={4}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
                 />
                {/* Feature editing UI (individual inputs) commented out for now
                {(editValues.features || []).map((feature, index) => (
                  <div key={index} className="flex items-center space-x-2 mt-1">
                    <input type="text" value={feature} onChange={(e) => handleFeatureChange(index, e.target.value)} className="flex-grow border border-gray-300 rounded-md shadow-sm p-2"/>
                    <button type="button" onClick={() => handleRemoveFeature(index)} className="text-red-500 hover:text-red-700">Remove</button>
                  </div>
                ))}
                <button type="button" onClick={handleAddFeature} className="mt-2 text-sm text-blue-600 hover:text-blue-800">+ Add Feature</button>
                */}
              </div>

              <div>
                <label htmlFor="price.monthly" className="block text-sm font-medium">Monthly Price ($)</label>
                <input type="number" name="price.monthly" id="price.monthly" value={editValues.price?.monthly || ''} onChange={handleFormChange} step="0.01" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"/>
              </div>
              <div>
                <label htmlFor="price.yearly" className="block text-sm font-medium">Yearly Price ($)</label>
                <input type="number" name="price.yearly" id="price.yearly" value={editValues.price?.yearly || ''} onChange={handleFormChange} step="0.01" className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"/>
              </div>
               <div>
                <label htmlFor="order" className="block text-sm font-medium">Display Order</label>
                <input type="number" name="order" id="order" value={editValues.order || 0} onChange={handleFormChange} className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"/>
              </div>
              <div className="flex items-center">
                <input type="checkbox" name="isActive" id="isActive" checked={editValues.isActive || false} onChange={handleFormChange} className="h-4 w-4 text-blue-600 border-gray-300 rounded mr-2"/>
                <label htmlFor="isActive" className="text-sm font-medium">Is Active</label>
              </div>

              <div className="flex justify-end space-x-3">
                <button type="button" onClick={handleCancelEdit} className="px-4 py-2 border border-gray-300 rounded-md text-sm font-medium hover:bg-gray-50" disabled={saving}>Cancel</button>
                <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-md text-sm font-medium hover:bg-blue-700 disabled:opacity-50" disabled={saving}>
                  {saving ? (editingPlanId ? 'Saving...' : 'Creating...') : (editingPlanId ? 'Save Changes' : 'Create Plan')}
                </button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}


      {/* Status messages */}
      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
          Error: {error}
        </div>
      )}
      
      {successMessage && (
        <div className="bg-green-100 border border-green-400 text-green-700 px-4 py-3 rounded">
          {successMessage}
        </div>
      )}

      {loading ? (
        <div className="text-center py-10">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-current border-r-transparent align-[-0.125em] text-blue-600 motion-reduce:animate-[spin_1.5s_linear_infinite]"></div>
          <p className="mt-2">Loading subscription tiers...</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3"> {/* Adjusted grid for potentially more info */}
          {subscriptionPlans.map(plan => (
            <Card key={plan._id} className="overflow-hidden flex flex-col">
              <CardHeader className={`text-white ${
                plan.planId === 'FREE' ? 'bg-gray-700' :
                plan.planId === 'PLUS' ? 'bg-blue-600' :
                plan.planId === 'PREMIUM' ? 'bg-purple-700' : 'bg-teal-600' // Default color for other plans
              }`}>
                <CardTitle className="flex justify-between items-center">
                  <div>
                    <span>{plan.name} ({plan.planId})</span>
                    {plan.isDefault && (
                      <span className="ml-2 px-2 py-0.5 bg-yellow-400 text-yellow-800 text-xs font-semibold rounded-full animate-pulse">
                        Default
                      </span>
                    )}
                  </div>
                  {plan.price && plan.price.monthly !== undefined && (
                    <span className="text-2xl">${plan.price.monthly.toFixed(2)}/mo</span>
                  )}
                </CardTitle>
                <CardDescription className="text-white opacity-90 min-h-[40px]">
                  {plan.description}
                </CardDescription>
              </CardHeader>
              
              <CardContent className="p-6 flex-grow">
                <div className="mb-4">
                  <h4 className="font-medium mb-2">Features</h4>
                    <ul className="list-disc pl-5 space-y-1 text-sm">
                      {(plan.features || []).map((feature: string, index: number) => (
                        <li key={index}>{feature}</li>
                      ))}
                      {(plan.features || []).length === 0 && <li className="text-gray-400">No features listed.</li>}
                    </ul>
                </div>
              
                <div className="border-t pt-4 mt-auto">
                  <div className="flex justify-between items-center mb-1">
                    <span className="text-sm font-medium">Daily Likes:</span>
                    <span className="text-sm">{plan.dailyLikeQuota}</span>
                  </div>
                  
                  { (plan.price && (plan.price.monthly !== undefined || plan.price.yearly !== undefined)) && (
                    <>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">Monthly Price:</span>
                        <span className="text-sm">{plan.price?.monthly !== undefined ? `$${plan.price.monthly.toFixed(2)}` : 'N/A'}</span>
                      </div>
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-sm font-medium">Yearly Price:</span>
                        <span className="text-sm">{plan.price?.yearly !== undefined ? `$${plan.price.yearly.toFixed(2)}` : 'N/A'}</span>
                      </div>
                    </>
                  )}
                   <div className="flex justify-between items-center mt-2">
                    <span className="text-sm font-medium">Active:</span>
                    <span className={`text-sm px-2 py-0.5 rounded-full ${plan.isActive ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                      {plan.isActive ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center mt-1">
                     <span className="text-sm font-medium">Order:</span>
                     <span className="text-sm">{plan.order}</span>
                  </div>
                   {plan.isDefault && (
                    <div className="flex justify-center items-center mt-2 p-2 bg-yellow-100 border border-yellow-300 rounded-md">
                        <span className="text-sm font-semibold text-yellow-700">This is the default plan for new users.</span>
                    </div>
                   )}
                </div>
              </CardContent>
              
              <CardFooter className="border-t p-4 flex flex-wrap justify-end items-center gap-2">
                  {/* Buttons now correctly call the refactored handlers */}
                  
                    <button
                      onClick={() => handleSetDefaultPlan(plan._id)}
                      className={`px-3 py-1.5 rounded text-sm text-white font-medium ${
                        plan.isDefault || !plan.isActive
                          ? 'bg-gray-300 cursor-not-allowed'
                          : 'bg-green-500 hover:bg-green-600 focus:ring-2 focus:ring-green-500 focus:ring-opacity-50'
                      } transition-colors duration-150 ease-in-out`}
                      disabled={plan.isDefault || !plan.isActive || saving}
                      title={plan.isDefault ? "This plan is already the default" : (!plan.isActive ? "Plan must be active to set as default" : "Set as default plan")}
                    >
                      {saving && !plan.isDefault ? 'Setting...' : (plan.isDefault ? '✓ Default' : 'Set Default')}
                    </button>
                    <button
                      onClick={() => handleEditPlan(plan)}
                      className="px-3 py-1.5 bg-blue-500 hover:bg-blue-600 text-white rounded text-sm font-medium focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors duration-150 ease-in-out"
                      disabled={saving}
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => handleDeletePlan(plan._id)}
                      className="px-3 py-1.5 bg-red-500 hover:bg-red-600 text-white rounded text-sm font-medium focus:ring-2 focus:ring-red-500 focus:ring-opacity-50 transition-colors duration-150 ease-in-out"
                      disabled={saving || plan.isDefault} // Prevent deleting the default plan directly
                      title={plan.isDefault ? "Cannot delete the default plan. Set another plan as default first." : "Delete this plan"}
                    >
                      Delete
                    </button>
                  
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
